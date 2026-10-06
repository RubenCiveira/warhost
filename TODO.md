# Pendiente

## Sin cobertura

- [ ] **Aviso para instalar la PWA en iPhone/iPad.** Safari, sin instalar,
  borra todo lo que guarda la web (service worker, cache e IndexedDB) tras 7
  dias de uso de Safari sin entrar en ella: en un local sin cobertura la web ni
  abre. Instalada en la pantalla de inicio no le pasa. Mostrar, solo en Safari
  de iOS y fuera de `display-mode: standalone`, un aviso descartable: "Para
  usarla sin cobertura, anadela a la pantalla de inicio".
- [ ] **Fecha de la copia local** en la lista de ejercitos ("Copia local
  actualizada el ..."), para saber antes de salir lo reciente que es. Sirve
  tambien si se edito desde otro dispositivo.
- [ ] **Salir con un listado en curso** puede volver a escribir la copia en
  IndexedDB despues de vaciarla (`olvidarCopiaLocal` en `src/api/armies.ts`). No
  la ve otro jugador, porque se filtra por usuario, pero queda en el dispositivo
  hasta el siguiente listado o salida.
