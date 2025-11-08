/**
 * Solar position calculations for realistic sun positioning
 * Based on NOAA Solar Position Calculator algorithms
 */

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/**
 * Calculate Julian Day from date
 */
function getJulianDay(date: Date): number {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()
  const second = date.getUTCSeconds()

  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3

  let jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045

  const fractionalDay = (hour - 12) / 24 + minute / 1440 + second / 86400

  return jdn + fractionalDay
}

/**
 * Calculate sun position for given date/time and observer location
 * Returns azimuth (0-360°, 0=North) and elevation (-90 to 90°)
 */
export function calculateSunPosition(date: Date, latitude: number = 0, longitude: number = 0): { azimuth: number; elevation: number; x: number; y: number; z: number } {
  const jd = getJulianDay(date)
  const jc = (jd - 2451545.0) / 36525.0 // Julian century

  // Calculate geometric mean longitude of sun (degrees)
  let L = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360
  if (L < 0) L += 360

  // Calculate geometric mean anomaly of sun (degrees)
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)

  // Calculate eccentricity of Earth orbit
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)

  // Calculate sun equation of center
  const C =
    Math.sin(M * DEG_TO_RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * M * DEG_TO_RAD) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * M * DEG_TO_RAD) * 0.000289

  // Calculate sun true longitude
  const sunTrueLong = L + C

  // Calculate sun apparent longitude
  const omega = 125.04 - 1934.136 * jc
  const lambda = sunTrueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG_TO_RAD)

  // Calculate obliquity of ecliptic
  const epsilon = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
  const epsilon0 = epsilon + 0.00256 * Math.cos(omega * DEG_TO_RAD)

  // Calculate sun declination
  const declination = Math.asin(Math.sin(epsilon0 * DEG_TO_RAD) * Math.sin(lambda * DEG_TO_RAD)) * RAD_TO_DEG

  // Calculate equation of time (minutes)
  const y_eot = Math.tan((epsilon0 / 2) * DEG_TO_RAD) ** 2
  const eqTime =
    4 *
    RAD_TO_DEG *
    (y_eot * Math.sin(2 * L * DEG_TO_RAD) -
      2 * e * Math.sin(M * DEG_TO_RAD) +
      4 * e * y_eot * Math.sin(M * DEG_TO_RAD) * Math.cos(2 * L * DEG_TO_RAD) -
      0.5 * y_eot * y_eot * Math.sin(4 * L * DEG_TO_RAD) -
      1.25 * e * e * Math.sin(2 * M * DEG_TO_RAD))

  // Calculate hour angle
  const timeOffset = eqTime + 4 * longitude
  const tst = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + timeOffset
  let hourAngle = tst / 4 - 180
  if (hourAngle < -180) hourAngle += 360

  // Calculate solar zenith angle
  const zenith =
    Math.acos(
      Math.sin(latitude * DEG_TO_RAD) * Math.sin(declination * DEG_TO_RAD) +
        Math.cos(latitude * DEG_TO_RAD) * Math.cos(declination * DEG_TO_RAD) * Math.cos(hourAngle * DEG_TO_RAD)
    ) * RAD_TO_DEG

  const elevation = 90 - zenith

  // Calculate azimuth
  let azimuth
  if (hourAngle > 0) {
    azimuth =
      (Math.acos(
        (Math.sin(latitude * DEG_TO_RAD) * Math.cos(zenith * DEG_TO_RAD) - Math.sin(declination * DEG_TO_RAD)) /
          (Math.cos(latitude * DEG_TO_RAD) * Math.sin(zenith * DEG_TO_RAD))
      ) *
        RAD_TO_DEG +
        180) %
      360
  } else {
    azimuth =
      (540 -
        Math.acos(
          (Math.sin(latitude * DEG_TO_RAD) * Math.cos(zenith * DEG_TO_RAD) - Math.sin(declination * DEG_TO_RAD)) /
            (Math.cos(latitude * DEG_TO_RAD) * Math.sin(zenith * DEG_TO_RAD))
        ) *
          RAD_TO_DEG) %
      360
  }

  // Convert to 3D position (Cartesian coordinates for Three.js)
  // Azimuth: 0° = North, 90° = East, 180° = South, 270° = West
  // Elevation: 0° = horizon, 90° = zenith
  const distance = 10 // Distance from Earth center
  const elevRad = elevation * DEG_TO_RAD
  const azRad = azimuth * DEG_TO_RAD

  const x = distance * Math.cos(elevRad) * Math.sin(azRad)
  const y = distance * Math.sin(elevRad)
  const z = distance * Math.cos(elevRad) * Math.cos(azRad)

  return { azimuth, elevation, x, y, z }
}
