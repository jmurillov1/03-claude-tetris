---
name: clima
description: Consulta el clima/tiempo actual de una ciudad desde la terminal, sin necesitar API key. Usar cuando el usuario pregunte por el clima, temperatura, pronóstico o condiciones meteorológicas de un lugar.
---

# Clima

Esta skill consulta el clima actual (y pronóstico corto) de una ciudad ejecutando un script local que llama a servicios públicos gratuitos, sin requerir API key ni configuración previa.

## Cómo usarla

Ejecuta el script pasando el nombre de la ciudad como argumento:

```bash
bash .claude/skills/clima/scripts/clima.sh "Bogotá"
```

Si el usuario no especifica una ciudad, **no preguntes**: ejecuta el script sin argumentos y por defecto consultará el clima de **Cuenca, Ecuador**.

```bash
bash .claude/skills/clima/scripts/clima.sh
```

## Cómo funciona

El script intenta primero `wttr.in` (formato de texto plano, ideal para terminal). Si esa petición falla (sin red, servicio caído, etc.), hace fallback automático a la API de `open-meteo.com`:

1. Geocodifica el nombre de la ciudad con `geocoding-api.open-meteo.com` para obtener latitud/longitud.
2. Consulta `api.open-meteo.com` para obtener temperatura actual, sensación térmica, humedad y viento.

Ambos servicios son gratuitos y no requieren autenticación.

## Notas

- Requiere `curl` instalado (ya disponible en la mayoría de sistemas Linux/macOS/WSL).
- Requiere conexión a internet (los datos meteorológicos no se pueden generar "offline"; "localmente" aquí se refiere a que se ejecuta como script local en la terminal, sin depender de una cuenta o API key propia).
- Si la ciudad tiene espacios o tildes, pásala entre comillas.
- Presenta el resultado al usuario de forma resumida y clara (temperatura, sensación térmica, condición, viento), no pegues el JSON crudo salvo que lo pida.
