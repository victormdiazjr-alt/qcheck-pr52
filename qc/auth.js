/* Guardián de sesión — QCheck.
   PROTOTIPO: es una puerta de demostración, no seguridad real.
   Las credenciales viven en el navegador; cualquiera puede ver el código.
   La autenticación de verdad llega con el backend propio. */
(function () {
  if (sessionStorage.getItem("qc-auth") === "1") return;
  var aqui = location.pathname.split("/").pop() + location.search + location.hash;
  location.replace("login.html?next=" + encodeURIComponent(aqui));
})();
