const urlParams = new URLSearchParams(window.location.search);

document.querySelectorAll('a[recurrent]').forEach((link) => {
    let url = new URL(link.href);
    let next = urlParams.get('next') || window.location.pathname + window.location.search;
    url.searchParams.append('next', next);
    link.href = url.toString();
});

function getHidden(id) {
    return document.querySelector('hidden#' + id).innerHTML
}