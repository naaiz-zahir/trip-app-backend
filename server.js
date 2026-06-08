const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// JSONBin config — set these as environment variables on Railway
const JSONBIN_BIN_ID  = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL     = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

app.use(cors()); // Allow requests from GitHub Pages
app.use(express.json());

function normalizeSelectedDivers(divers) {
    if (!Array.isArray(divers)) return [];

    return divers
        .filter((diver) => typeof diver === 'string')
        .map((diver) => diver.trim())
        .filter((diver) => diver.length > 0);
}

function buildTripSummary(trip = {}) {
    const selectedDivers = normalizeSelectedDivers(trip.selectedDivers ?? trip.divers);
    const summary = { ...trip };

    delete summary.selectedDivers;
    delete summary.divers;

    if (selectedDivers.length > 0) {
        summary.divers = selectedDivers;
    }

    return summary;
}

// Helper: read the full database from JSONBin
async function readDB() {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    if (!res.ok) throw new Error(`JSONBin read failed: ${res.status}`);
    const data = await res.json();
    return data.record; // { boats, locations, crew, divers }
}

// Helper: write the full database back to JSONBin
async function writeDB(record) {
    const res = await fetch(JSONBIN_URL, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': JSONBIN_API_KEY
        },
        body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error(`JSONBin write failed: ${res.status}`);
    return res.json();
}

// GET /api/database — returns the full database
app.get('/api/database', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to read database' });
    }
});

// POST /api/trip-summary — returns a normalized trip summary.
// The divers list is included only when at least one diver is selected.
app.post('/api/trip-summary', (req, res) => {
    res.json(buildTripSummary(req.body));
});

// POST /api/add — adds a new item to a category
app.post('/api/add', async (req, res) => {
    const { category, value } = req.body;

    const validCategories = ['boats', 'locations', 'crew', 'divers'];
    if (!validCategories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
    }
    if (!value || typeof value !== 'string' || value.trim() === '') {
        return res.status(400).json({ error: 'Invalid value' });
    }

    try {
        const db = await readDB();
        if (!db[category]) db[category] = [];

        const trimmed = value.trim();
        if (db[category].includes(trimmed)) {
            return res.status(409).json({ error: 'Entry already exists' });
        }

        db[category].push(trimmed);
        await writeDB(db);

        res.json({ success: true, category, value: trimmed, updated: db[category] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update database' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Trip Message Generator backend running on port ${PORT}`);
});
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Trip Message Generator backend running on port ${PORT}`);
    });
}

module.exports = {
    app,
    buildTripSummary,
    normalizeSelectedDivers
};
