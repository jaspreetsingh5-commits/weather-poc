# 🌦️ Weather Service Task

A Node.js service that returns a weather forecast using the **National Weather Service (NWS)** API.  
Given latitude and longitude, the service returns:

- The short forecast for **today**  
- A temperature characterization: `cold`, `moderate`, or `hot`

## 🚀 Getting Started

### 1. Install Node
Use **Node 16+** (Node 18 recommended):

```bash
node -v
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the service
```bash
npm start
```

Or development mode:
```bash
npm run dev
```

## 🌐 API Usage

### GET /weather
Example:
```
http://localhost:3000/weather?lat=39.7456&lon=-97.0892
```

### Query Parameters

| Name | Required | Description |
|------|----------|-------------|
| lat | Yes | Latitude (-90..90) |
| lon | Yes | Longitude (-180..180) |

### Example Response

```json
{
  "latitude": 39.7456,
  "longitude": -97.0892,
  "forecast": {
    "periodName": "Today",
    "shortForecast": "Mostly Sunny",
    "temperature": {
      "value": 72,
      "unit": "F",
      "characterization": "moderate"
    }
  },
  "source": "https://api.weather.gov"
}
```

## 🛠 Project Structure

```
app.js
index.js
package.json
tests/
README.md
```

## ❗ Error Handling

Invalid coordinates:
```json
{
  "error": {
    "code": "INVALID_COORDINATES_PASSEd",
    "message": "Use valid coordinates"
  }
}
```

NWS error:
```json
{
  "error": {
    "code": "NWS_UPSTREAM_ERROR",
    "message": "Err to get weather from the National Weather Service."
  }
}
```

## 🧪 Testing
```bash
npm test
```