export function AccessDenied() {
  return (
    <div className="app-card mx-auto max-w-xl p-8 text-center">
      <i
        className="bi bi-shield-lock text-3xl text-[var(--brand)]"
        aria-hidden="true"
      />
      <h1 className="mt-3 text-lg font-semibold">
        No tienes permiso para esta sección
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        El backend vuelve a validar los permisos de tu rol; esta vista solo
        oculta lo que no corresponde.
      </p>
    </div>
  );
}
