# Ejemplos y debug

Laboratorio de Warhost para probar el módulo reutilizable `../../maps`.
Este directorio contiene el código de preparación y prueba de los escenarios;
no es necesario copiarlo al reutilizar el mapa base.

- `domain/mapDocument.ts`: documentos de debug, borrador/configurado y
  operaciones de creación, pintura y redimensionado.
- `infrastructure/mapStorage.ts`: persistencia local versionada.
- `presentation/`: listado, editor, formulario y estilos del laboratorio.
- `fixtures/demoMaps.ts`: mapas de ejemplo.
- `tests/`: pruebas de dominio, configuración, persistencia e interfaz.
- `index.ts`: componente público `MapLab`.

Warhost monta `MapLab` en `/maps` sin iniciar sesión y en `/mapas` desde el
menú autenticado. El núcleo de mapas no importa nada de este módulo.

## Configuración y persistencia

Se pueden crear salas, pasillos y lugares abiertos con cuadrados o hexágonos,
de 1 a 40 columnas/filas. El editor aplica terreno, atrezo con nombre, cofres,
objetivos y salidas opcionales en el borde. Los lugares abiertos no admiten
puertas. Las salidas nuevas no tienen destino; las conexiones recíprocas de
los ejemplos siguen funcionando.

En hexágonos, las medias casillas del contorno rectangular son muros
impasables y no admiten atrezo ni salidas. Crear o redimensionar aplica esta
regla automáticamente. Al cargar mapas antiguos también se adapta el borde:
se retiran objetos y salidas de las casillas recortadas y sus referencias en
la exploración. La adaptación se guarda con el siguiente cambio del usuario.

Configurar bloquea el diseño y permite explorar. Volver a editar conserva el
estado. Reducir el tamaño puede retirar elementos fuera de los límites, previa
confirmación. Los ejemplos conectados no permiten redimensionado.

Se conservan diseño, fase y exploración en `localStorage`, con la misma clave
`warhost:maps:v1` utilizada antes de la separación. Los mapas ya guardados
siguen disponibles. El almacenamiento es local al navegador y origen, compartido
por ambas rutas, sin sincronización por cuenta o dispositivo.
Los fallos de lectura bloquean la edición para no sobrescribir datos; los
fallos de escritura se muestran sin aplicar el cambio.

## Verificación

Desde `warhost`:

```sh
npm run test:maps
npm run test:maps:ui
npm run build
```

Las pruebas requieren Node.js y esbuild; las de interfaz también Playwright y
Chrome. Sus rutas se resuelven desde los propios scripts.
