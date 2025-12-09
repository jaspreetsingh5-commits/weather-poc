const express = require("express");
const Joi = require("joi");
const { fetchForecastPeriods } = require("./nwsClient");
const { HttpError, isHttpError } = require("./errors");
const { logger } = require("./logger");

const app = express();

function classifyTemperature(tempF) {
  if (tempF == null || Number.isNaN(tempF)) return "pls pass temp";
  if (tempF <= 45) return "cold";
  if (tempF >= 80) return "hot";
  return "moderate";
}

function pickTodayPeriod(periods) {
  const daytime = periods.find && periods.find((p) => p.isDaytime);
  return daytime || periods[0];
}

const coordSchema = Joi.object({
  lat: Joi.number().required().min(-90).max(90),
  lon: Joi.number().required().min(-180).max(180)
}).required();

function validateCoordinates(query) {
  const { error, value } = coordSchema.validate(query, {
    convert: true,
    allowUnknown: true,
    abortEarly: true
  });

  if (error) {
    throw new HttpError(
      400,
      "INVALID_COORDINATES_PASSED",
      "Use valid coordinates",
      { details: error.details }
    );
  }

  return value;
}

function validateForecastPeriod(period) {
  if (!period || typeof period !== "object") {
    throw new HttpError(
      502,
      "FORECAST_DATA_INVALID",
      "National Weather Service returned invalid forecast data."
    );
  }

  const missingFields = [];
  if (period.name == null) missingFields.push("name");
  if (period.shortForecast == null) missingFields.push("shortForecast");
  if (period.temperature == null) missingFields.push("temperature");
  if (period.temperatureUnit == null) missingFields.push("temperatureUnit");

  if (missingFields.length > 0) {
    throw new HttpError(
      502,
      "FORECAST_DATA_INCOMPLETE",
      "National Weather Service returned incomplete forecast data.",
      { missingFields }
    );
  }

  if (typeof period.temperature !== "number" || Number.isNaN(period.temperature)) {
    throw new HttpError(
      502,
      "FORECAST_TEMPERATURE_INVALID",
      "Forecast temperature is not a valid number."
    );
  }

  return period;
}

function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Basic request logging and tracing
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || generateRequestId();
  req.requestId = requestId;
  req.log = logger.child({ requestId, method: req.method, path: req.path });

  req.log.info("request_started");
  res.on("finish", () => {
    req.log.info("request_completed", { statusCode: res.statusCode });
  });

  next();
});

app.get("/weather", async (req, res, next) => {
  let lat;
  let lon;
  try {
    const validated = validateCoordinates(req.query);
    lat = validated.lat;
    lon = validated.lon;
  } catch (validationError) {
    return next(validationError);
  }

  try {
    const periods = await fetchForecastPeriods(lat, lon, req.log);
    const today = validateForecastPeriod(pickTodayPeriod(periods));

    const tempVal = today.temperature;
    const tempUnit = today.temperatureUnit;

    const characterization =
      tempUnit === "F" ? classifyTemperature(tempVal) : "unknown";

    res.json({
      latitude: lat,
      longitude: lon,
      forecast: {
        periodName: today.name,
        shortForecast: today.shortForecast,
        temperature: {
          value: tempVal,
          unit: tempUnit,
          characterization
        }
      },
      source: "https://api.weather.gov"
    });
  } catch (error) {
    req.log.error("weather_route_error", { message: error.message, code: error.code });
    next(error);
  }
});

//default route
app.get("/", (req, res) => {
  res.send(
    "Weather Service Task running"
  );
});

app.use((err, req, res, next) => {
  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred.";

  if (isHttpError(err)) {
    status = err.statusCode || status;
    code = err.code || code;
    message = err.message || message;
  }

  if (req && req.log) {
    req.log.error("request_error", { status, code, message });
  } else {
    logger.error("unscoped_error", { status, code, message });
  }

  res.status(status).json({
    error: { code, message }
  });
});

module.exports = app;
