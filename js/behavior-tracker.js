// js/behavior-tracker.js
export class BehaviorTracker {
    static track() {
        // Track scroll depth
        let maxScroll = 0;
        window.addEventListener('scroll', () => {
            const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;
                if (maxScroll >= 25 && maxScroll % 25 < 1) {
                    Analytics.trackEvent('scroll_depth', { depth: Math.floor(maxScroll) });
                }
            }
        });
        
        // Track time on page
        const startTime = Date.now();
        window.addEventListener('beforeunload', () => {
            const timeSpent = (Date.now() - startTime) / 1000;
            Analytics.trackEvent('time_on_page', { seconds: Math.floor(timeSpent) });
        });
        
        // Track click heatmap
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button, a, .clickable');
            if (target) {
                Analytics.trackEvent('click', {
                    element: target.tagName,
                    id: target.id || target.className,
                    text: target.textContent?.slice(0, 50)
                });
            }
        });
    }
}