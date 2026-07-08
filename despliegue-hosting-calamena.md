# Despliegue NexoComunidad — hosting cliente Gran Diablada Calameña

## Objetivo
Desplegar la rama `cliente/calamena` en el dominio propio del cliente.

## Hosting del cliente

| Campo | Valor |
|-------|-------|
| Dominio | grandiabladacalameña.cl (punycode: `xn--grandiabladacalamea-d4b.cl`) |
| Proveedor | BlueHosting.cl (Haulmer) |
| IP | 186.64.114.50 |
| CMS actual | WordPress |

## Bloqueo actual (vigente desde julio 2026)

El cliente solo tiene acceso a wp-admin de WordPress, **no al cPanel de BlueHosting**. Son paneles distintos.

Antes de continuar, pedirle al cliente (o a quien contrató el hosting) que confirme desde cPanel:

1. ¿Aparece "Setup Node.js App" en la sección Software?
2. ¿Tiene Terminal/SSH habilitado (sección Avanzado)?
3. ¿Tiene MySQL/phpMyAdmin disponible?

## Requisito técnico de BlueHosting

Node.js solo funciona en planes **Cloud Hosting o VPS** con cPanel + Terminal. Los planes compartidos orientados a WordPress no lo traen por defecto.

## Plan de despliegue (cuando llegue el acceso)

1. Subir código: `git clone` desde `Pillage1982/club-deportivo-app`, rama `cliente/calamena`
2. Crear app en "Setup Node.js App":
   - Archivo de arranque: `backend/server.js` (o según lo que configure Hostinger)
3. Configurar variables de entorno en el panel (nunca subir `.env` al repo):
   ```
   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, EMAIL_USER, EMAIL_PASS
   ```
4. Crear BD MySQL e importar esquema
5. `npm install` desde Terminal del panel
6. Apuntar dominio a la Application URL

## Notas de soporte (referencia Hostinger — aplica al servidor devclub también)

```bash
# npm no está en PATH — usar ruta completa
/opt/alt/alt-nodejs22/root/usr/bin/npm install

# Reiniciar la app: hPanel → Sitios web → [sitio] → Node.js → Reiniciar

# Siempre hacer npm install después de un git pull que modifique package.json
```
