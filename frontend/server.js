const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// ======================================== STATIC FILES
app.use(express.static(__dirname, {
    extensions: ['html'],
    index: 'index.html'
}));

// ======================================== EXPLICIT ROUTES
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/learn', (req, res) => {
    res.sendFile(path.join(__dirname, 'learn.html'));
});

app.get('/learn.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'learn.html'));
});

// ======================================== 404 HANDLER
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ======================================== START SERVER
app.listen(PORT, () => {
    console.log(`Frontend server running on port ${PORT}`);
});
