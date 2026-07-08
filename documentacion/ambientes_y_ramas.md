# Ambientes y Ramas

## Ramas Git

| Rama | Propósito |
|------|-----------|
| `main` | Producción estable — no se trabaja directamente |
| `v1.3-dev` | Desarrollo activo NexoComunidad genérico |
| `cliente/calamena` | Personalización Gran Diablada Calameña |

## Ambientes Hostinger

| Sitio | Rama | BD |
|-------|------|----|
| club.pillageweb.cl | main | BD producción (no cargar seeds de prueba) |
| devnexo.pillageweb.cl | v1.3-dev | BD dev |
| devclub.pillageweb.cl | cliente/calamena | BD calamena |
| nexocomunidad.pillageweb.cl | — | Landing comercial (sin BD) |

## Flujo de trabajo

Cambios en `v1.3-dev` o `cliente/calamena`:
```bash
git checkout v1.3-dev   # o cliente/calamena
git pull
# ... hacer cambios ...
git add archivo1 archivo2
git commit -m "descripción"
git push
```

Pasar a producción solo cuando esté probado en devnexo:
```bash
git checkout main
git merge v1.3-dev
git push
```

## Reglas

- No subir `.env` ni `node_modules`
- No usar BD de producción para pruebas
- No hacer cherry-pick entre `v1.3-dev` y `cliente/calamena` — las ramas están muy divergidas, aplicar cambios manualmente
- Pedir autorización antes de commit y push
- Revisar en devnexo antes de fusionar a main

## Deploy en Hostinger (SSH)

```bash
# Conectar por SSH y navegar al proyecto
cd ~/domains/devclub.pillageweb.cl/nodejs

# Actualizar código
git pull

# Si se modificó package.json
/opt/alt/alt-nodejs22/root/usr/bin/npm install

# Reiniciar: hPanel → Sitios web → [sitio] → Node.js → Reiniciar
```

## Checklist antes de merge a main

- [ ] Login admin, tesorero y entrenador probados
- [ ] Dashboard carga datos
- [ ] Módulos principales funcionan (integrantes, eventos, asistencias, finanzas)
- [ ] Sin errores en consola del navegador
- [ ] Rama pushada a GitHub
- [ ] Documentación actualizada
