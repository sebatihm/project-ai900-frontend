# Río Claro · Frontend Asistente IA

Frontend web para la plataforma de Río Claro. La aplicación proporciona un
asistente de IA para operaciones internas, un chat público para clientes y
módulos administrativos para gestionar inventario, facturas, proveedores,
tickets e informes.

Está construido con Next.js App Router, React, TypeScript, Bootstrap,
Bootstrap Icons y Tailwind CSS.

## Funcionalidades

- Autenticación mediante sesión HTTP-only.
- Control de acceso basado en roles y permisos.
- Chat interno para consultar inventario, productos, pedidos, sucursales y
  almacenes.
- Chat público para clientes, sin acceso a información interna.
- Mensajes de texto y audio en el chat.
- Gestión de productos, proveedores, facturas y tickets.
- Consulta y descarga de informes.
- Analizador público de facturas mediante un enlace por proveedor:
  `/chat/invoice-analyzer/{supplierId}`.
- Proxy de API entre el navegador y el backend.
- Favicon y metadatos configurados para la aplicación.

## Rutas principales

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `/login` | Público | Inicio de sesión. |
| `/assistant` | Autenticado | Chat interno y chat público. |
| `/reports` | Según permisos | Informes de ventas. |
| `/tickets` | Según permisos | Lista y detalle de tickets. |
| `/products` | Según permisos | Administración de productos. |
| `/invoices` | Según permisos | Administración y análisis interno de facturas. |
| `/suppliers` | Según permisos | Administración de proveedores. |
| `/chat/invoice-analyzer/{supplierId}` | Público | Carga y análisis público de facturas. |

Las rutas protegidas se validan en `src/proxy.ts`. El analizador público no
requiere una sesión de usuario.

## Requisitos

- Node.js 20.9 o superior.
- npm.
- Backend de Río Claro disponible y accesible desde el frontend.

## Configuración

Crea un archivo `.env.local` en la raíz del proyecto:

```env
BACKEND_URL=http://localhost:8080
PUBLIC_UPLOAD_KEY=tu-clave-de-carga-publica
```

`BACKEND_URL` es la URL base del backend. `PUBLIC_UPLOAD_KEY` se utiliza en el
endpoint público de análisis de facturas y debe coincidir con la configuración
del backend.

No agregues secretos reales al repositorio.

## Instalación y desarrollo

Instala las dependencias:

```bash
npm install
```

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run lint     # Validación ESLint
npm run build    # Compilación de producción
npm run start    # Servidor de producción
```

Para ejecutar la aplicación en producción:

```bash
npm run build
npm run start
```

## Estructura relevante

```text
src/
├── app/
│   ├── (app)/              # Layout y módulos autenticados
│   ├── api/                # Routes de proxy hacia el backend
│   ├── chat/               # Analizador público de facturas
│   ├── invoice-analyzer/   # Compatibilidad con enlaces anteriores
│   └── login/              # Inicio de sesión
├── components/             # Componentes reutilizables de UI
├── lib/                    # API, sesión, permisos, formatos y tipos
└── proxy.ts                # Protección de rutas y sesión
```

El layout autenticado se aplica al grupo `src/app/(app)`. El analizador
ubicado en `src/app/chat/invoice-analyzer/[supplierId]` está fuera de ese
grupo para no heredar el layout ni requerir autenticación.