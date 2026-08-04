let sponsors = [], current = 0, timer;
fetch("/docs/sponsors.json").then(r => r.json()).then(data => {
    sponsors = data;
    const sc = document.getElementById("slides");
    const dc = document.getElementById("dots");
    sponsors.forEach((s, i) => {
        const d = document.createElement("div");
        d.className = "slide";
        d.innerHTML = (s.url ? '<a href="' + s.url + '" target="_blank">' : '') +
            '<img src="' + s.file + '" alt="' + s.name + '">' +
            (s.url ? '</a>' : '') +
            '<div class="name">' + s.name + '</div>' +
            (s.url ? '<a class="visit" href="' + s.url + '" target="_blank">Visiter le site</a>' : '');
        sc.appendChild(d);
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.onclick = () => show(i);
        dc.appendChild(dot);
    });
    show(0);
    //timer = setInterval(next, 5000);
    document.querySelector(".carousel").onmouseenter = () => clearInterval(timer);
    document.querySelector(".carousel").onmouseleave = () => timer = setInterval(next, 5000);
});
function show(i) {
    current = (i + sponsors.length) % sponsors.length;
    document.querySelectorAll(".slide").forEach((e, n) => e.classList.toggle("active", n === current));
    document.querySelectorAll(".dot").forEach((e, n) => e.classList.toggle("active", n === current));
}
function next() { show(current + 1) }
function prev() { show(current - 1) }
document.querySelector(".next").onclick = next;
document.querySelector(".prev").onclick = prev;