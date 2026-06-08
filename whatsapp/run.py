"""Запуск WhatsApp-бота: uvicorn на порту из конфига (по умолчанию 8001).

    python -m whatsapp.run

Перед запуском заполните whatsapp/secrets.env (см. secrets.example.env) и
поднимите туннель на этот порт (см. whatsapp/README.md).
"""
import uvicorn

from . import config as cfg

if __name__ == "__main__":
    uvicorn.run("whatsapp.app:app", host="0.0.0.0", port=cfg.PORT, reload=False)
