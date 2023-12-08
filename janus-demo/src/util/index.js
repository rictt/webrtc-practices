export function getParam(queryName) {
  let url = window.location.href
  let query = decodeURI(url.split('?')[1]);
  let vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] === queryName) {
      return pair[1];
    }
  }
  return null;
}