const axios = require("axios");
const { HttpError } = require("./errors");
const { logger: baseLogger } = require("./logger");

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWithRetry(url, options, log, retries = DEFAULT_RETRIES, delayMs = DEFAULT_RETRY_DELAY_MS) {
  let attempt = 0;
  while (true) {
    try {
      if (log) {
        log.info("nws_http_attempt", { url, attempt });
      }
      return await axios.get(url, options);
    } catch (err) {
      if (attempt >= retries) {
        if (log) {
          log.error("nws_http_attempt_failed", { url, attempt, message: err.message });
        }
        throw err;
      }
      attempt += 1;
      if (log) {
        log.warn("nws_http_retry", { url, attempt });
      }
      await sleep(delayMs);
    }
  }
}

async function fetchForecastPeriods(lat, lon, log = baseLogger) {
  const scopedLog = log.child({ lat, lon });
  const userAgent =
    process.env.NWS_USER_AGENT ||
    "weather-service-task (example@example.com)";

  const pointUrl = `https://api.weather.gov/points/${lat},${lon}`;

  try {
    scopedLog.info("nws_point_request_start", { url: pointUrl });
    const pointResponse = await getWithRetry(pointUrl, {
      headers: { "User-Agent": userAgent, Accept: "application/geo+json" },
      timeout: 5000
    }, scopedLog);
    scopedLog.info("nws_point_request_success");

    const forecastUrl =
      pointResponse.data &&
      pointResponse.data.properties &&
      pointResponse.data.properties.forecast;

    if (!forecastUrl) {
      throw new HttpError(
        502,
        "NWS_FORECAST_URL_MISSING",
        "National Weather Service response : URL missinf."
      );
    }

    scopedLog.info("nws_forecast_request_start", { url: forecastUrl });
    const forecastResponse = await getWithRetry(forecastUrl, {
      headers: { "User-Agent": userAgent, Accept: "application/geo+json" },
      timeout: 5000
    }, scopedLog);
    scopedLog.info("nws_forecast_request_success");

    const periods =
      forecastResponse.data &&
      forecastResponse.data.properties &&
      forecastResponse.data.properties.periods;

    if (!Array.isArray(periods) || periods.length === 0) {
      throw new HttpError(
        502,
        "NWS_FORECAST_EMPTY",
        "No forecast periods returned by National Weather Service."
      );
    }

    return periods;
  } catch (err) {
    const statusCode =
      err && err.response && err.response.status
        ? err.response.status
        : 502;

    scopedLog.error("nws_request_failed", { message: err.message });
    throw new HttpError(
      statusCode,
      "NWS_UPSTREAM_ERROR",
      "Err to get weather from National Weather Service."
    );
  }
}

module.exports = {
  fetchForecastPeriods
};
