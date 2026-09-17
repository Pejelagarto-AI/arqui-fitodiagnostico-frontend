// Config centralizada del front. La URL base de la API se puede sobreescribir
// sin tocar código con el query param ?api=<url>, útil para probar contra un
// mock o un backend desplegado en otro origen.
const parametrosUrl = new URLSearchParams(window.location.search);
const apiOverride = parametrosUrl.get("api");

export const API_BASE = apiOverride || "http://localhost:8080/api/v1";
