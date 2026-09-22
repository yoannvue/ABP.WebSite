function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

function getWeekStart(referenceDate = new Date()) {
    const current = new Date(referenceDate);
    const day = current.getDay(); // 0=dimanche ... 6=samedi
    const daysSinceMonday = (day + 6) % 7;
    current.setDate(current.getDate() - daysSinceMonday);
    current.setHours(0, 0, 0, 0);
    return current;
}

function getWeekRange(referenceDate = new Date()) {
    const start = getWeekStart(referenceDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(0, 0, 0, 0);
    return { start, end };
}

function getCurrentWeekDateRange(referenceDate = new Date()) {
    const current = new Date(referenceDate);
    const day = current.getDay();

    if (day === 1) {
        const start = getWeekStart(new Date(current));
        start.setDate(start.getDate() - 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { start, end };
    }

    return getWeekRange(current);
}

function getPreviousWeekDateRange(referenceDate = new Date()) {
    const currentWeekStart = getWeekStart(referenceDate);
    const start = new Date(currentWeekStart);
    start.setDate(currentWeekStart.getDate() - 7);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
}

function getDateRangeForMode(mode, referenceDate = new Date()) {
    const normalizedMode = (mode || '').toLowerCase();

    if (normalizedMode.includes('rencontres')) {
        return getCurrentWeekDateRange(referenceDate);
    }

    if (normalizedMode.includes('resultats')) {
        return getPreviousWeekDateRange(referenceDate);
    }

    const start = new Date(referenceDate);
    const end = new Date(referenceDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 7);
    return { start, end };
}

module.exports = {
    formatDate,
    getWeekStart,
    getWeekRange,
    getCurrentWeekDateRange,
    getPreviousWeekDateRange,
    getDateRangeForMode,
};
