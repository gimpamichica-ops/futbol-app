# F?tbol

PWA est?tica, sin dependencias, con datos ESPN, partidos, equipos favoritos, detalles y tablas.

Pruebas: `node tools/probar.mjs`. Para abrirla, serv? `public/` con un servidor HTTP; el service worker requiere HTTPS o localhost.

Cloudflare Pages: conect? el repositorio, sin comando de build, directorio de salida `public`. Sin claves ni variables. Configuraci?n: `public/ligas.js`.

Los fixtures son ejemplos manuales de la estructura documentada: la descarga con curl no estuvo disponible. Los datos y cobertura dependen de ESPN.
