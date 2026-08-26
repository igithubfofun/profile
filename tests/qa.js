/* QA suite — run against a locally served copy of the site.
   Usage: BASE=http://localhost:PORT node qa.js                                */

const { chromium, devices } = require("playwright");

const BASE = process.env.BASE || "http://localhost:8160";
const results = [];
let failures = 0;

function check(name, pass, detail) {
    results.push({ name, pass, detail });
    if (!pass) failures++;
}

const VIEWPORTS = [
    ["desktop-1440", { viewport: { width: 1440, height: 900 } }],
    ["laptop-1280", { viewport: { width: 1280, height: 800 } }],
    ["tablet-768", { viewport: { width: 768, height: 1024 } }],
    ["iphone-13", devices["iPhone 13"]],
    ["iphone-se", { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }],
    ["galaxy-s", { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }],
    ["narrow-320", { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }],
];

(async () => {
    const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

    /* ---------- 1. Console / network health, both themes ---------- */
    for (const scheme of ["light", "dark"]) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
        const jsErrors = [];
        const badRequests = [];
        page.on("pageerror", e => jsErrors.push(e.message));
        page.on("console", m => { if (m.type() === "error" && !/ERR_(CONNECTION|TUNNEL|NAME)/.test(m.text())) jsErrors.push("console: " + m.text()); });
        page.on("response", r => {
            const u = r.url();
            if (r.status() >= 400 && u.startsWith(BASE)) badRequests.push(r.status() + " " + u);
        });
        await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(600);
        check(`[${scheme}] no JS errors`, jsErrors.length === 0, jsErrors.join("; "));
        check(`[${scheme}] no broken local assets`, badRequests.length === 0, badRequests.join("; "));
        await page.close();
    }

    /* ---------- 2. Layout: no horizontal overflow at any width ---------- */
    for (const [name, opts] of VIEWPORTS) {
        const page = await browser.newPage(opts);
        await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(400);
        // reveal everything so off-screen content is measured too
        await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach(e => e.classList.add("is-revealed")));
        await page.evaluate(async () => {
            const h = document.body.scrollHeight;
            for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 15)); }
            window.scrollTo(0, 0);
        });
        const o = await page.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const bad = [];
            document.querySelectorAll("body *").forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0 && (r.right > vw + 1.5 || r.left < -1.5)) {
                    const cs = getComputedStyle(el);
                    if (cs.position === "fixed" || cs.visibility === "hidden" || el.closest(".aurora")) return;
                    bad.push(el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""));
                }
            });
            return { scrollW: document.documentElement.scrollWidth, vw, bad: [...new Set(bad)].slice(0, 6) };
        });
        check(`[${name}] no horizontal overflow`, o.scrollW <= o.vw + 1, `scrollW=${o.scrollW} vw=${o.vw} offenders=${o.bad.join(", ")}`);
        await page.close();
    }

    /* ---------- 3. Navigation anchors land below the sticky header ---------- */
    for (const [name, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["mobile", devices["iPhone 13"]]]) {
        for (const id of ["about", "experience", "work", "contact"]) {
            const page = await browser.newPage(opts);
            await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
            if (name === "mobile") { await page.click(".nav-toggle"); await page.waitForTimeout(300); }
            await page.click(`.site-nav a[href="#${id}"]`);
            await page.waitForTimeout(1200);
            const r = await page.evaluate((i) => {
                const el = document.getElementById(i);
                const top = el.getBoundingClientRect().top;
                const headerH = document.querySelector(".site-header").getBoundingClientRect().height;
                const atBottom = Math.abs((window.scrollY + window.innerHeight) - document.documentElement.scrollHeight) < 3;
                return { top, headerH, atBottom };
            }, id);
            // Either it lands just under the header, or the page physically can't scroll further.
            const ok = r.atBottom || (r.top >= r.headerH - 4 && r.top <= r.headerH + 40);
            check(`[${name}] nav → #${id} lands correctly`, ok, `top=${Math.round(r.top)} headerH=${Math.round(r.headerH)} atBottom=${r.atBottom}`);
            await page.close();
        }
    }

    /* ---------- 4. Page opens at top even with a stale hash ---------- */
    {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(BASE + "/#work", { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(700);
        const y = await page.evaluate(() => window.scrollY);
        check("stale #hash does not auto-scroll", y === 0, `scrollY=${y}`);
        check("stale #hash stripped from URL", !page.url().includes("#"), page.url());
        await page.close();
    }

    /* ---------- 5. Mobile menu behaviour ---------- */
    {
        const page = await browser.newPage(devices["iPhone 13"]);
        await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
        const hiddenFirst = await page.evaluate(() => !document.getElementById("site-nav").classList.contains("is-open"));
        check("[mobile] menu starts closed", hiddenFirst);
        await page.click(".nav-toggle");
        await page.waitForTimeout(250);
        const opened = await page.evaluate(() => document.getElementById("site-nav").classList.contains("is-open"));
        const aria = await page.getAttribute(".nav-toggle", "aria-expanded");
        check("[mobile] menu opens", opened);
        check("[mobile] aria-expanded=true when open", aria === "true", `aria=${aria}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(250);
        const closedEsc = await page.evaluate(() => !document.getElementById("site-nav").classList.contains("is-open"));
        check("[mobile] Escape closes menu", closedEsc);
        await page.close();
    }

    /* ---------- 6. Theme toggle + persistence ---------- */
    {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
        const page = await ctx.newPage();
        await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
        await page.click(".theme-toggle");
        await page.waitForTimeout(200);
        const t1 = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        check("theme toggles to dark", t1 === "dark", `data-theme=${t1}`);
        const stored = await page.evaluate(() => { try { return localStorage.getItem("theme"); } catch (e) { return "ERR"; } });
        check("theme persisted to localStorage", stored === "dark", `stored=${stored}`);
        await page.reload({ waitUntil: "networkidle" });
        const t2 = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        check("theme survives reload", t2 === "dark", `data-theme=${t2}`);
        // contrast sanity: body text vs background must differ
        const c = await page.evaluate(() => {
            const cs = getComputedStyle(document.body);
            return { bg: cs.backgroundColor, fg: cs.color };
        });
        check("dark theme paints its own background", c.bg !== "rgba(0, 0, 0, 0)" && c.bg !== "transparent", JSON.stringify(c));
        await ctx.close();
    }

    /* ---------- 7. Email obfuscation + copy ---------- */
    {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
        const rawHtml = await (await fetch(BASE + "/index.html")).text();
        check("email absent from raw HTML source", !/metelpatel@gmail\.com/.test(rawHtml));
        check("phone number absent from raw HTML", !/469-?432-?1255/.test(rawHtml));
        const href = await page.getAttribute(".contact-actions .email-link", "href");
        check("email link assembled at runtime", href === "mailto:metelpatel@gmail.com", `href=${href}`);
        const beforeClick = await page.textContent("#emailText");
        check("email NOT shown before click", beforeClick.trim() !== "metelpatel@gmail.com", `text=${beforeClick}`);
        await ctxCopyTest(page);
        const afterClick = await page.textContent("#emailText");
        check("email revealed in contact card after click", afterClick.trim() === "metelpatel@gmail.com", `text=${afterClick}`);
        await page.close();

        async function ctxCopyTest(p) {
            await p.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => { });
            await p.click("#copyEmail");
            await p.waitForTimeout(400);
            const visible = await p.evaluate(() => document.getElementById("toast").classList.contains("is-visible"));
            check("copy-email shows confirmation toast", visible);
        }
    }

    /* ---------- 8. Accessibility basics ---------- */
    {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
        const a11y = await page.evaluate(() => {
            const imgsNoAlt = [...document.querySelectorAll("img")].filter(i => i.getAttribute("alt") === null).map(i => i.src);
            const btnsNoName = [...document.querySelectorAll("button")].filter(b =>
                !b.textContent.trim() && !b.getAttribute("aria-label")).length;
            const linksNoName = [...document.querySelectorAll("a")].filter(a =>
                !a.textContent.trim() && !a.getAttribute("aria-label") && a.getAttribute("aria-hidden") !== "true").length;
            const h1s = document.querySelectorAll("h1").length;
            const lang = document.documentElement.getAttribute("lang");
            const title = document.title;
            const desc = document.querySelector('meta[name="description"]');
            const landmarks = {
                header: !!document.querySelector("header"),
                main: !!document.querySelector("main"),
                footer: !!document.querySelector("footer"),
                nav: !!document.querySelector("nav[aria-label]"),
            };
            return { imgsNoAlt, btnsNoName, linksNoName, h1s, lang, title, hasDesc: !!desc, landmarks };
        });
        check("all <img> have alt attributes", a11y.imgsNoAlt.length === 0, a11y.imgsNoAlt.join(", "));
        check("all buttons have accessible names", a11y.btnsNoName === 0, `${a11y.btnsNoName} unnamed`);
        check("all links have accessible names", a11y.linksNoName === 0, `${a11y.linksNoName} unnamed`);
        check("exactly one <h1>", a11y.h1s === 1, `count=${a11y.h1s}`);
        check("html[lang] set", a11y.lang === "en", `lang=${a11y.lang}`);
        check("non-empty <title>", !!a11y.title, a11y.title);
        check("meta description present", a11y.hasDesc);
        check("landmarks present", Object.values(a11y.landmarks).every(Boolean), JSON.stringify(a11y.landmarks));

        // keyboard: skip-link is first stop and becomes visible
        await page.keyboard.press("Tab");
        const skip = await page.evaluate(() => {
            const el = document.activeElement;
            return { cls: el.className, left: el.getBoundingClientRect().left };
        });
        check("skip-link focused first and on-screen", skip.cls.includes("skip-link") && skip.left >= 0, JSON.stringify(skip));
        await page.close();
    }

    /* ---------- 9. Reduced motion ---------- */
    {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
        await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(500);
        const r = await page.evaluate(() => {
            const els = [...document.querySelectorAll("[data-reveal]")];
            const hidden = els.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.9).length;
            return { total: els.length, hidden };
        });
        check("[reduced-motion] no content left invisible", r.hidden === 0, `${r.hidden}/${r.total} hidden`);
        await page.close();
    }

    /* ---------- 10. No-JS resilience ---------- */
    {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
        const page = await ctx.newPage();
        await page.goto(BASE + "/", { waitUntil: "load", timeout: 30000 });
        await page.waitForTimeout(300);
        const r = await page.evaluate === undefined ? null : await page.evaluate(() => {
            const els = [...document.querySelectorAll("[data-reveal]")];
            const hidden = els.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.9).length;
            return { total: els.length, hidden, bodyText: document.body.innerText.length };
        });
        check("[no-JS] content still visible", r && r.hidden === 0, r ? `${r.hidden}/${r.total} hidden` : "eval failed");
        check("[no-JS] page has readable content", r && r.bodyText > 400, r ? `chars=${r.bodyText}` : "");
        await ctx.close();
    }

    /* ---------- 11. Outbound links sane ---------- */
    {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
        const links = await page.evaluate(() =>
            [...document.querySelectorAll('a[href^="http"]')].map(a => ({
                href: a.href, target: a.target, rel: a.rel
            })));
        const insecure = links.filter(l => l.href.startsWith("http://"));
        check("no http:// links (mixed content)", insecure.length === 0, insecure.map(l => l.href).join(", "));
        const unsafeTarget = links.filter(l => l.target === "_blank" && !/noopener/.test(l.rel));
        check("all _blank links use rel=noopener", unsafeTarget.length === 0, unsafeTarget.map(l => l.href).join(", "));
        const ghLinks = links.filter(l => /github\.com\/igithubfofun/.test(l.href));
        check("project links point at real repos", ghLinks.length >= 6, `found=${ghLinks.length}`);
        await page.close();
    }

    /* ---------- 12. Experience section reflects real employers ---------- */
    {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
        const text = await page.evaluate(() => document.getElementById("experience").innerText);
        for (const co of ["Meta", "Dropbox", "Bazaarvoice", "General Assembly"]) {
            check(`experience mentions ${co}`, text.includes(co));
        }
        // No fabricated dates: no bare 4-digit years or mm/yy ranges anywhere
        // in the experience section, since none were supplied.
        const hasDates = /\b(19|20)\d{2}\b|\b\d{1,2}\/\d{2,4}\b/.test(text);
        check("no invented dates in experience section", !hasDates, text.match(/\b(19|20)\d{2}\b|\b\d{1,2}\/\d{2,4}\b/g));
        await page.close();
    }

    await browser.close();

    /* ---------- Report ---------- */
    console.log("\n=== QA RESULTS ===\n");
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${!r.pass && r.detail ? "\n        → " + r.detail : ""}`);
    }
    console.log(`\n${results.length - failures}/${results.length} passed, ${failures} failed\n`);
    process.exit(failures ? 1 : 0);
})();
