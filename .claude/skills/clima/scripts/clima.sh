#!/usr/bin/env bash
set -euo pipefail

CIUDAD="${1:-Cuenca, Ecuador}"
CIUDAD_ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$CIUDAD")

# Intento 1: wttr.in (texto plano, sin API key)
if WTTR_OUT=$(curl -fsS --max-time 8 "https://wttr.in/${CIUDAD_ENC}?format=%l:+%C+%t+(sensación+%f)+humedad+%h+viento+%w&lang=es" 2>/dev/null); then
  echo "$WTTR_OUT"
  exit 0
fi

echo "wttr.in no disponible, usando open-meteo como respaldo..." >&2

# Intento 2: open-meteo (geocoding + forecast, sin API key)
GEO=$(curl -fsS --max-time 8 "https://geocoding-api.open-meteo.com/v1/search?name=${CIUDAD_ENC}&count=1&language=es&format=json")

LAT=$(echo "$GEO" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['results'][0]['latitude'])")
LON=$(echo "$GEO" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['results'][0]['longitude'])")
NOMBRE=$(echo "$GEO" | python3 -c "import json,sys;d=json.load(sys.stdin);r=d['results'][0];print(r['name']+(', '+r.get('country','') if r.get('country') else ''))")

FORECAST=$(curl -fsS --max-time 8 "https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code")

echo "$FORECAST" | python3 - "$NOMBRE" <<'EOF'
import json, sys

nombre = sys.argv[1]
data = json.load(sys.stdin)
c = data["current"]

WEATHER_CODES = {
    0: "despejado", 1: "mayormente despejado", 2: "parcialmente nublado", 3: "nublado",
    45: "niebla", 48: "niebla con escarcha",
    51: "llovizna ligera", 53: "llovizna moderada", 55: "llovizna intensa",
    61: "lluvia ligera", 63: "lluvia moderada", 65: "lluvia intensa",
    71: "nieve ligera", 73: "nieve moderada", 75: "nieve intensa",
    80: "chubascos ligeros", 81: "chubascos moderados", 82: "chubascos violentos",
    95: "tormenta", 96: "tormenta con granizo", 99: "tormenta con granizo intenso",
}
condicion = WEATHER_CODES.get(c.get("weather_code"), "condición desconocida")

print(f"{nombre}: {condicion}, {c['temperature_2m']}°C "
      f"(sensación {c['apparent_temperature']}°C), "
      f"humedad {c['relative_humidity_2m']}%, "
      f"viento {c['wind_speed_10m']} km/h")
EOF
