document.querySelectorAll('a[recurrent]').forEach((link) => {
    let url = new URL(link.href);
    let short = window.location.pathname + window.location.search;
    url.searchParams.append('next', short);
    link.href = url.toString();
});