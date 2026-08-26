/* =============================================================================
   Metel Patel — personal site
   Vanilla JS, no dependencies. Every feature degrades gracefully.
   ========================================================================== */

(function () {
    "use strict";

    var root = document.documentElement;
    root.classList.remove("no-js");

    var reduceMotion = window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : { matches: false };


    /* --- Theme -------------------------------------------------------------
       The inline script in <head> applies any saved choice before paint;
       here we only wire up the toggle. */

    function storeTheme(value) {
        try {
            localStorage.setItem("theme", value);
        } catch (e) {
            /* Private mode — the choice just won't persist. */
        }
    }

    var themeToggle = document.querySelector(".theme-toggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            var prefersDark =
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches;
            var current = root.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
            var next = current === "dark" ? "light" : "dark";
            root.setAttribute("data-theme", next);
            storeTheme(next);
        });
    }


    /* --- Mobile navigation -------------------------------------------------- */

    var navToggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");

    function closeNav() {
        if (!nav || !navToggle) return;
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
    }

    if (navToggle && nav) {
        navToggle.addEventListener("click", function () {
            var open = nav.classList.toggle("is-open");
            navToggle.setAttribute("aria-expanded", open ? "true" : "false");
            navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        });

        nav.addEventListener("click", function (e) {
            if (e.target.closest("a")) closeNav();
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeNav();
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth > 680) closeNav();
        });
    }


    /* --- Email links --------------------------------------------------------
       Assembled at runtime so the address isn't in the page source for basic
       scrapers to harvest. */

    var EMAIL = null;

    Array.prototype.forEach.call(
        document.querySelectorAll("[data-user][data-domain]"),
        function (el) {
            var address = el.getAttribute("data-user") + "@" + el.getAttribute("data-domain");
            EMAIL = address;
            if (el.tagName === "A") {
                el.setAttribute("href", "mailto:" + address);
            }
        }
    );

    // Reveal the address in the contact card once JS has assembled it.
    var emailText = document.getElementById("emailText");
    if (emailText && EMAIL) emailText.textContent = EMAIL;


    /* --- Toast --------------------------------------------------------------- */

    var toastEl = document.getElementById("toast");
    var toastTimer;

    function toast(message) {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toastEl.classList.remove("is-visible");
        }, 2400);
    }


    /* --- Copy email to clipboard --------------------------------------------- */

    var copyBtn = document.getElementById("copyEmail");
    if (copyBtn) {
        copyBtn.addEventListener("click", function () {
            if (!EMAIL) return;

            function done() {
                toast("Email copied to clipboard ✨");
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(EMAIL).then(done, fallback);
            } else {
                fallback();
            }

            // execCommand path for older browsers and non-secure contexts
            function fallback() {
                try {
                    var ta = document.createElement("textarea");
                    ta.value = EMAIL;
                    ta.setAttribute("readonly", "");
                    ta.style.position = "fixed";
                    ta.style.opacity = "0";
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                    done();
                } catch (e) {
                    toast(EMAIL);
                }
            }
        });
    }


    /* --- Rotating tagline word ------------------------------------------------ */

    var rotator = document.querySelector(".rotator-word");
    if (rotator && !reduceMotion.matches) {
        var words = ["web apps", "REST APIs", "clean interfaces", "side projects"];
        var i = 0;

        setInterval(function () {
            // Skip work while the tab is hidden.
            if (document.hidden) return;

            rotator.classList.add("is-out");
            setTimeout(function () {
                i = (i + 1) % words.length;
                rotator.textContent = words[i];
                rotator.classList.remove("is-out");
                rotator.classList.add("is-in");
                setTimeout(function () {
                    rotator.classList.remove("is-in");
                }, 400);
            }, 280);
        }, 2600);
    }


    /* --- Scroll reveal --------------------------------------------------------- */

    var revealables = document.querySelectorAll("[data-reveal]");

    if (!("IntersectionObserver" in window) || reduceMotion.matches) {
        Array.prototype.forEach.call(revealables, function (el) {
            el.classList.add("is-revealed");
        });
    } else {
        var io = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-revealed");
                        io.unobserve(entry.target);
                    }
                });
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
        );
        Array.prototype.forEach.call(revealables, function (el) {
            io.observe(el);
        });
    }


    /* --- Scroll progress + active nav link -------------------------------------- */

    var progress = document.querySelector(".scroll-progress span");
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(".site-nav a"));
    var sections = navLinks
        .map(function (a) {
            return document.querySelector(a.getAttribute("href"));
        })
        .filter(Boolean);

    var ticking = false;

    function onScroll() {
        if (ticking) return;
        ticking = true;

        window.requestAnimationFrame(function () {
            // Progress bar
            if (progress) {
                var max = document.documentElement.scrollHeight - window.innerHeight;
                var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
                progress.style.width = Math.min(100, Math.max(0, pct)) + "%";
            }

            // Highlight the section currently under the header
            if (sections.length) {
                var marker = window.scrollY + (window.innerHeight * 0.32);
                var activeIndex = -1;
                for (var s = 0; s < sections.length; s++) {
                    if (sections[s].offsetTop <= marker) activeIndex = s;
                }
                navLinks.forEach(function (link, idx) {
                    link.classList.toggle("is-active", idx === activeIndex);
                });
            }

            ticking = false;
        });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();


    /* --- Card spotlight ---------------------------------------------------------- */

    if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
        Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card) {
            card.addEventListener("mousemove", function (e) {
                var r = card.getBoundingClientRect();
                card.style.setProperty("--mx", (e.clientX - r.left) + "px");
                card.style.setProperty("--my", (e.clientY - r.top) + "px");
            });
        });
    }


    /* --- Portrait tilt ------------------------------------------------------------ */

    var tilt = document.getElementById("portraitTilt");
    if (
        tilt &&
        !reduceMotion.matches &&
        window.matchMedia &&
        window.matchMedia("(hover: hover)").matches
    ) {
        var MAX = 9; // degrees

        tilt.addEventListener("mousemove", function (e) {
            var r = tilt.getBoundingClientRect();
            var px = (e.clientX - r.left) / r.width - 0.5;
            var py = (e.clientY - r.top) / r.height - 0.5;
            tilt.style.transform =
                "rotateY(" + (px * MAX * 2) + "deg) rotateX(" + (-py * MAX * 2) + "deg) scale(1.02)";
        });

        tilt.addEventListener("mouseleave", function () {
            tilt.style.transform = "";
        });
    }


    /* --- Footer year ---------------------------------------------------------------- */

    var year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();


    /* --- Easter egg: Konami code ------------------------------------------------------
       ↑ ↑ ↓ ↓ ← → ← → B A — tips the whole page into a barrel roll. */

    var SEQUENCE = [
        "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
        "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"
    ];
    var pos = 0;

    document.addEventListener("keydown", function (e) {
        var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        pos = key === SEQUENCE[pos] ? pos + 1 : (key === SEQUENCE[0] ? 1 : 0);

        if (pos === SEQUENCE.length) {
            pos = 0;
            if (reduceMotion.matches) {
                toast("You found it. 🕹️");
                return;
            }
            document.body.style.transition = "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)";
            document.body.style.transform = "rotate(360deg)";
            toast("Do a barrel roll! 🕹️");
            setTimeout(function () {
                document.body.style.transition = "";
                document.body.style.transform = "";
            }, 1200);
        }
    });

})();
