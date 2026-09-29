# Mapa base reutilizable

Copia este directorio a otro proyecto para reutilizar el mapa. No depende del
laboratorio, del editor, de almacenamiento, de rutas ni de servicios de Warhost.

- `domain/map.ts`: casillas, terreno, atrezo, puertas, definición y estado de
  exploración. Validación de mapas y acciones puras.
- `application/mapSession.ts`: sesiones con estado independiente por mapa.
- `presentation/MapBoard.tsx`: tablero controlado cuadrado o hexagonal.
- `presentation/maps.css`: estilos exclusivos del tablero.
- `index.ts`: API pública.

La aplicación consumidora proporciona la definición y el estado a `MapBoard`,
recibe `onSelectCell` y decide las acciones, navegación y persistencia.
Los tipos permiten salas, pasillos y lugares abiertos (`battlefield`), terreno
normal, difícil e impasable, cofres, objetivos y atrezo. Las salidas sin destino
son marcadores; las puertas conectadas tienen extremos recíprocos.
Las coordenadas empiezan en cero; los hexágonos usan filas alternas desplazadas.

Los mapas hexagonales tienen un contorno rectangular: se recortan por el centro
las filas superior e inferior y, alternativamente, las casillas laterales.
En las esquinas se combinan ambos recortes. El tamaño incluye estas casillas
de muro, que son siempre impasables. `isClippedHex` identifica el borde y
`alignHexBoundary` adapta una definición, retirando atrezo y salidas del muro.
`validateMaps` rechaza bordes recortados transitables. El tablero recorta su
contenido dentro de ese rectángulo para permitir colocar mapas contiguos.
Con una o dos filas no quedan casillas completas transitables; el laboratorio
no permite marcar esos diseños como configurados.

## Uso

Requiere React y soporte de TypeScript/TSX e imports CSS. Los estilos incluyen
valores alternativos para las variables de tema; no necesitan el CSS de Warhost.

```tsx
import { useState } from "react";
import { createMapState, MapBoard } from "./modules/maps";
import type { MapDefinition } from "./modules/maps";

export function Board({ map }: { map: MapDefinition }) {
  const [selectedCellId, setSelectedCellId] = useState<string>();
  const [state] = useState(createMapState);

  return <MapBoard map={map} state={state} selectedCellId={selectedCellId}
    onSelectCell={cell => setSelectedCellId(cell.id)} />;
}
```

Para usar solo el dominio, importa `domain/map` o `application/mapSession`
directamente y evita cargar React/CSS.

## Laboratorio externo

El listado, creación, configuración, borradores, persistencia local, escenarios
y pruebas están en `../examples/debug`. La dependencia es unidireccional:
el laboratorio consume el mapa base y este no conoce el laboratorio.

Las rutas de Warhost `/maps` y `/mapas` montan ese módulo externo.
Las pruebas se ejecutan desde `warhost-react` con `npm run test:maps` y
`npm run test:maps:ui`.
