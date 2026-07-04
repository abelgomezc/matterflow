// MatterFlow - copyright siempre visible (esquina inferior derecha). (c) 2026 Abel Gomez
export default function Copyright() {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-30 select-none text-right">
      <div className="text-xs font-medium tracking-wide text-white/40">
        © 2026 Abel Gomez · MatterFlow
      </div>
      <div className="text-[10px] text-white/25">
        Todos los derechos reservados
      </div>
    </div>
  )
}