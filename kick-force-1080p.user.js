// ==UserScript==
// @name         Force 1080p on Kick
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Force highest quality on Kick.com + quality drop watcher
// @match        *://*.kick.com/*
// @grant        none
// ==/UserScript==

// This script is not mine
// Source: https://github.com/Kacper-wa/Force-1080p-on-Twitch-Kick
// License: MIT


(function () {
    'use strict';

    let attemptInterval;
    let watcherInterval;
    let attempts = 0;
    let canForce1080 = false;
    const MAX_ATTEMPTS = 25;

    function findMainVideo() {
        const videos = Array.from(document.querySelectorAll('video'))
            .filter(v => v.offsetParent !== null && v.clientWidth * v.clientHeight > 0);
        videos.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
        return videos[0] || null;
    }

    function getCurrentResolution() {
        const video = findMainVideo();
        return video ? video.videoHeight : 0;
    }

    function simulateClick(el) {
        if (!el) return;
        el.focus();
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
            el.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        });
    }

    function autoCloseMenu() {
        document.body.click();
        const video = findMainVideo();
        if (video) {
            video.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
    }

    function wakeUpPlayer() {
        const video = findMainVideo();
        if (video) {
            const event = new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 });
            video.dispatchEvent(event);
            if (video.parentElement) video.parentElement.dispatchEvent(event);
        }
    }

    function looksLikeAvatar(btn) {
        if (btn.closest('header')) return true;
        if (btn.querySelector('img,[data-testid*="avatar" i]')) return true;
        const aria = (btn.getAttribute('aria-label') || "").toLowerCase();
        return /\b(profile|account|avatar|user)\b/.test(aria);
    }

    function findSettingsButton(video) {
        if (!video) return null;
        const vRect = video.getBoundingClientRect();

        const menuButtons = Array.from(document.querySelectorAll('button[aria-haspopup="menu"]'))
            .filter(b => !looksLikeAvatar(b) &&
                  (b.getBoundingClientRect().bottom > vRect.top && b.getBoundingClientRect().top < vRect.bottom));
        
        if (menuButtons.length) {
            menuButtons.sort((a, b) => {
                const ca = a.getBoundingClientRect();
                const cb = b.getBoundingClientRect();
                const da = Math.hypot(vRect.right - (ca.left + ca.width / 2), vRect.bottom - (ca.top + ca.height / 2));
                const db = Math.hypot(vRect.right - (cb.left + cb.width / 2), vRect.bottom - (cb.top + cb.height / 2));
                return da - db;
            });
            return menuButtons[0];
        }
        return null;
    }

    function pickQuality() {
        const items = Array.from(document.querySelectorAll('[role="menuitemradio"]'));
        if (!items.length) return false;

        const target = items.find(i => i.textContent.toLowerCase().includes('1080p') && !i.textContent.toLowerCase().includes('auto'));

        if (target) {
            simulateClick(target);
            canForce1080 = true;
            return true;
        }

        const nonAuto = items.filter(i => !/auto/i.test(i.textContent));
        if (nonAuto.length) {
            simulateClick(nonAuto[nonAuto.length - 1]);
            return true;
        }
        return false;
    }

    function setQualityKick() {
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
            clearInterval(attemptInterval);
            return;
        }

        wakeUpPlayer();

        const video = findMainVideo();
        const settingsButton = findSettingsButton(video);
        
        if (!settingsButton) return;

        simulateClick(settingsButton);

        setTimeout(() => {
            if (pickQuality()) {
                clearInterval(attemptInterval);
                setTimeout(autoCloseMenu, 180);
            } else {
                autoCloseMenu();
            }
        }, 350);
    }

    function startQualityWatcher() {
        if (watcherInterval) clearInterval(watcherInterval);
        watcherInterval = setInterval(() => {
            const res = getCurrentResolution();
            if (res > 0 && res < 1080 && canForce1080) {
                attempts = 0;
                setQualityKick();
            }
        }, 2000);
    }

    function init() {
        attempts = 0;
        canForce1080 = false;
        clearInterval(attemptInterval);
        clearInterval(watcherInterval);

        setTimeout(() => {
            attemptInterval = setInterval(setQualityKick, 500);
            startQualityWatcher();
        }, 700);
    }

    init();

    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            init();
        }
    }).observe(document, { subtree: true, childList: true });
})();
