import { useState, useEffect, useRef } from 'react';
import { startKaspiPayment, checkKaspiStatus } from '../utils/api';

// Один хук для обоих экранов оплаты (Kaspi QR и карта) — на терминале это один
// и тот же платёж, клиент сам выбирает способ. Экраны отличаются только текстом.
//
// phase: starting | waiting | processing | unknown | success | fail | error
//   starting   — отправляем запрос на старт оплаты
//   waiting    — терминал ждёт действие клиента (скан QR / прикладывание карты)
//   processing — идёт обработка (подтверждение QR, чтение карты, ввод PIN)
//   unknown    — терминал не уверен в результате; сервер сам актуализирует
//   success | fail | error — финал (fail = отказ по оплате, error = терминал недоступен)

const POLL_MS = 1500;
const MAX_WAIT_MS = 4 * 60 * 1000; // ~180с скан + 60с подтверждение + запас (док §3.18)
const PROCESSING_SUBS = ['WaitForQrConfirmation', 'ProcessingCard', 'WaitForPinCode'];

export function useKaspiPayment(sessionCode, settings, onSuccess) {
  const [phase, setPhase] = useState('starting');
  const [amount, setAmount] = useState(null);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0); // increment → перезапуск оплаты

  // onSuccess через ref, чтобы смена его идентичности не перезапускала эффект.
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    let stop = false;        // ставится в cleanup (размонтирование / перезапуск)
    let pollTimer = null;
    const deadline = Date.now() + MAX_WAIT_MS;

    // --- опрос статуса по кругу, пока не финал или не дедлайн ---
    const pollOnce = async (processId) => {
      if (stop) return;
      let st;
      try {
        st = await checkKaspiStatus(processId);
      } catch (err) {
        // временная ошибка сети — повторяем до дедлайна
        if (stop) return;
        if (Date.now() > deadline) { setPhase('error'); setMessage(String(err.message || err)); }
        else pollTimer = setTimeout(() => pollOnce(processId), POLL_MS);
        return;
      }
      if (stop) return;

      if (typeof st.amount === 'number') setAmount(st.amount);
      setMessage(st.message || '');

      if (st.status === 'success') { setPhase('success'); onSuccessRef.current && onSuccessRef.current(); return; }
      if (st.status === 'fail') { setPhase('fail'); return; }
      if (Date.now() > deadline) { setPhase('fail'); setMessage('Время ожидания истекло'); return; }

      setPhase(st.status === 'unknown' ? 'unknown'
        : PROCESSING_SUBS.includes(st.subStatus) ? 'processing' : 'waiting');
      pollTimer = setTimeout(() => pollOnce(processId), POLL_MS);
    };

    // --- старт оплаты (вызывается РОВНО один раз, см. ниже) ---
    const begin = async () => {
      if (stop) return;
      let res;
      try {
        res = await startKaspiPayment(sessionCode, settings);
      } catch (err) {
        if (!stop) { setPhase('error'); setMessage(String(err.message || err)); }
        return;
      }
      if (stop) return;
      if (!res.ok) { setPhase('error'); setMessage(res.error || ''); return; }
      if (typeof res.amount === 'number') setAmount(res.amount);
      setPhase('waiting');
      pollOnce(res.processId);
    };

    // В dev React.StrictMode делает mount → unmount → mount, поэтому эффект
    // выполняется дважды. Откладываем старт на тик: таймер ПЕРВОГО прохода
    // снимается в его cleanup, и реальный старт оплаты происходит ровно один раз
    // (иначе на терминал ушли бы два платежа, и второй упал бы как «занят»).
    const startTimer = setTimeout(begin, 0);

    return () => {
      stop = true;
      clearTimeout(startTimer);
      clearTimeout(pollTimer);
    };
    // settings берётся снимком на момент старта (к оплате он уже зафиксирован).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode, attempt]);

  const retry = () => {
    setMessage('');
    setPhase('starting');
    setAttempt((a) => a + 1);
  };

  return { phase, amount, message, retry };
}
