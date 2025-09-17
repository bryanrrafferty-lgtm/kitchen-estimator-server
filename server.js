    // Failed to connect to MongoDB
// ========================
// Imports & App Setup
// ========================
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = 3000;
const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

let db, suppliersCollection, projectsCollection, inventoryCollection;

// ========================
// MongoDB Connection
// ========================
async function connectToMongoDB() {
    await client.connect();
    db = client.db('inventoryDB');
    suppliersCollection = db.collection('suppliers');
    projectsCollection = db.collection('projects');
    inventoryCollection = db.collection('inventory');
}

// ========================
// Middleware
// ========================
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================
// Static File Routes
// ========================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/inventory', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'inventory.html'));
});

// ========================
// API Routes
// ========================

// --- SUPPLIERS ---

app.get('/api/suppliers', async (req, res, next) => {
    try {
        const suppliers = await suppliersCollection.find({}).toArray();
        const formattedSuppliers = {};
        suppliers.forEach(s => {
            formattedSuppliers[s.name] = { items: {} };
            (s.items || []).forEach(item => {
                if (!formattedSuppliers[s.name].items[item.name]) {
                    formattedSuppliers[s.name].items[item.name] = { models: {} };
                }
                formattedSuppliers[s.name].items[item.name].models[item.model] = {
                    square_footage: item.square_footage,
                    weight: item.weight
                };
            });
        });
        res.json({ suppliers: formattedSuppliers });
    } catch (err) {
        next(err);
    }
});

app.get('/api/suppliers/:name/items', async (req, res, next) => {
    try {
        const { name } = req.params;
        const supplier = await suppliersCollection.findOne({ name });
        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }
        const items = (supplier.items || []).map(item => ({
            _id: item._id.toString(),
            name: item.name,
            model: item.model,
            square_footage: item.square_footage,
            weight: item.weight
        }));
        res.json(items);
    } catch (err) {
        next(err);
    }
});

app.post('/api/suppliers', async (req, res, next) => {
    try {
        let { name } = req.body;
        name = name.trim();
        if (!name) return res.status(400).json({ error: 'Supplier name required' });
        const existing = await suppliersCollection.findOne({ name });
        if (existing) return res.status(409).json({ error: 'Supplier already exists' });
        await suppliersCollection.insertOne({ name, items: [] });
        res.status(201).json({ message: 'Supplier added' });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/suppliers/:name', async (req, res, next) => {
    try {
        let { name } = req.params;
        name = name.trim();
        await suppliersCollection.deleteOne({ name });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

app.post('/api/suppliers/:name/items', async (req, res, next) => {
    try {
        let { name } = req.params;
        name = name.trim();
        const { item_type, model_number, square_footage, weight } = req.body;
        if (!item_type || !model_number) return res.status(400).json({ error: 'Item type and model number required' });
        const supplier = await suppliersCollection.findOne({ name });
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        if ((supplier.items || []).some(i => i.name === item_type && i.model === model_number)) {
            return res.status(409).json({ error: 'Model already exists' });
        }
        const item = { _id: new ObjectId(), name: item_type, model: model_number, square_footage, weight, supplierId: { name } };
        await suppliersCollection.updateOne({ name }, { $push: { items: item } });
        res.status(201).json({ message: 'Item added' });
    } catch (err) {
        next(err);
    }
});

app.put('/api/suppliers/:name/items/:itemType/:modelNumber', async (req, res, next) => {
    try {
        let { name, itemType, modelNumber } = req.params;
        name = name.trim();
        itemType = itemType.trim();
        modelNumber = modelNumber.trim();
        const { new_supplier, item_type, model_number, square_footage, weight } = req.body;
        const supplier = await suppliersCollection.findOne({ name });
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        const itemIndex = (supplier.items || []).findIndex(i => i.name === itemType && i.model === modelNumber);
        if (itemIndex === -1) return res.status(404).json({ error: 'Item not found' });
        let item = supplier.items[itemIndex];
        if (new_supplier && new_supplier !== name) {
            const newSupplier = await suppliersCollection.findOne({ name: new_supplier });
            if (!newSupplier) return res.status(404).json({ error: 'New supplier not found' });
            supplier.items.splice(itemIndex, 1);
            await suppliersCollection.updateOne({ name }, { $set: { items: supplier.items } });
            item = { _id: item._id, name: item_type, model: model_number, square_footage, weight, supplierId: { name: new_supplier } };
            await suppliersCollection.updateOne({ name: new_supplier }, { $push: { items: item } });
        } else {
            item.name = item_type;
            item.model = model_number;
            item.square_footage = square_footage;
            item.weight = weight;
            await suppliersCollection.updateOne({ name }, { $set: { items: supplier.items } });
        }
        res.json({ message: 'Item updated' });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/suppliers/:name/items/:itemType/:modelNumber', async (req, res, next) => {
    try {
        let { name, itemType, modelNumber } = req.params;
        name = name.trim();
        itemType = itemType.trim();
        modelNumber = modelNumber.trim();
        const supplier = await suppliersCollection.findOne({ name });
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        supplier.items = (supplier.items || []).filter(i => !(i.name === itemType && i.model === modelNumber));
        await suppliersCollection.updateOne({ name }, { $set: { items: supplier.items } });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

// --- PROJECTS ---

app.get('/api/projects', async (req, res, next) => {
    try {
        const projects = await projectsCollection.find({}).toArray();
        const formatted = projects.reduce((acc, p) => {
            acc[p.project_key] = p;
            return acc;
        }, {});
        res.json(formatted);
    } catch (err) {
        next(err);
    }
});

app.get('/api/projects/:projectKey', async (req, res, next) => {
    try {
        const { projectKey } = req.params;
        const project = await projectsCollection.findOne({ project_key: projectKey });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (err) {
        next(err);
    }
});

app.post('/api/projects', async (req, res, next) => {
    try {
        const projectData = req.body;
        if (!projectData.project_key) projectData.project_key = new ObjectId().toString();
        await projectsCollection.updateOne({ project_key: projectData.project_key }, { $set: projectData }, { upsert: true });
        res.status(201).json(projectData);
    } catch (err) {
        next(err);
    }
});

app.patch('/api/projects/:projectKey', async (req, res) => {
    try {
        const projectKey = req.params.projectKey;
        const updateData = req.body;
        const result = await projectsCollection.updateOne(
            { project_key: projectKey },
            { $set: updateData }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.json({ message: 'Project updated' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update project', error: err.message });
    }
});

app.post('/api/project/update', async (req, res, next) => {
    try {
        const { project_key, updates } = req.body;
        if (!project_key || !updates || typeof updates !== 'object') {
            return res.status(400).json({ success: false, error: 'Missing project_key or updates' });
        }
        const result = await projectsCollection.updateOne(
            { project_key },
            { $set: updates }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/projects/:projectKey', async (req, res, next) => {
    try {
        const { projectKey } = req.params;
        await projectsCollection.deleteOne({ project_key: projectKey });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

// --- PROJECT SUMMARIES (INCLUDES STATUS) ---
app.get('/api/project-summaries', async (req, res) => {
    try {
        const projects = await db.collection('projects').find({}).toArray();
        const receiving = await db.collection('inventory').find({ type: 'Receiving' }).toArray();
        const inventory = await db.collection('inventory').find({ type: 'Inventory' }).toArray();
        const shipping = await db.collection('inventory').find({ type: 'Shipping' }).toArray();

        const summaries = projects.map(project => {
            const key = project.project_key || project.key || project.id;
            const allItems = receiving.concat(inventory, shipping).filter(i =>
                i.projectId === key || i.project_key === key || i.projectKey === key
            );
            const total = allItems.reduce((sum, i) => sum + Number(i.squareft || 0), 0);
            const received = inventory.concat(shipping)
                .filter(i => i.projectId === key || i.project_key === key || i.projectKey === key)
                .reduce((sum, i) => sum + Number(i.squareft || 0), 0);
            const balance = total - received;
            return {
                project_key: key,
                customer: project.customer,
                projectName: project.projectName,
                total: Number(total.toFixed(2)),
                received: Number(received.toFixed(2)),
                balance: Number(balance.toFixed(2)),
                status: project.status || '', // <-- Ensure status is included!
                poChecked: project.poChecked || false
                };
        });
        res.json(summaries);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get project summaries' });
    }
});

// --- INVENTORY ---
// --- DAILY TOTALS REPORTING ---
app.get('/api/daily-totals', async (req, res, next) => {
    try {
        const { projectKey, startDate, endDate } = req.query;
        if (!projectKey || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing projectKey, startDate, or endDate' });
        }
        const dailyTotalsCollection = db.collection('dailyTotals');
        // Debug log query params
        console.log('[dailyTotals] Query:', { projectKey, startDate, endDate });
        // Dates are in YYYY-MM-DD format
        const query = {
            projectId: projectKey,
            date: { $gte: startDate, $lte: endDate }
        };
        console.log('[dailyTotals] MongoDB Query:', query);
        const items = await dailyTotalsCollection.find(query).toArray();
        console.log('[dailyTotals] Results:', items);
        res.json(items);
    } catch (err) {
        next(err);
    }
});
// Get all inventory items
app.get('/api/inventory/all', async (req, res, next) => {
    try {
        const items = await inventoryCollection.find({}).toArray();
        res.json(items);
    } catch (err) {
        next(err);
    }
});

app.get('/api/inventory/:type', async (req, res, next) => {
    try {
        const { type } = req.params;
        const items = await inventoryCollection.find({ type }).toArray();
        res.json(items);
    } catch (err) {
        next(err);
    }
});

app.post('/api/inventory', async (req, res, next) => {
    try {
        const inventoryData = req.body;
        if (inventoryData.project_key && !inventoryData.projectId) {
            inventoryData.projectId = inventoryData.project_key;
        }
        const result = await inventoryCollection.insertOne(inventoryData);
        res.status(201).json({ id: result.insertedId });
    } catch (err) {
        next(err);
    }
});

app.get('/api/inventory/:type/:id', async (req, res, next) => {
    try {
        const { type, id } = req.params;
        const item = await inventoryCollection.findOne({ _id: new ObjectId(id), type });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (err) {
        next(err);
    }
});

app.patch('/api/inventory/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const log = (...args) => console.log('[dailyTotals]', ...args);
        // If type is being changed, set movedDate to today and store full item data in dailyTotals
        if (updateData.type) {
            // Use Arizona time (America/Phoenix) for movedDate
            const arizonaDate = new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' });
            // Format as YYYY-MM-DDTHH:mm:ss (ISO-like, but local time)
            const [datePart, timePart] = arizonaDate.split(', ');
            const [month, day, year] = datePart.split('/');
            const movedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`;
            updateData.movedDate = movedDate;
            // Fetch full item data before update
            const item = await inventoryCollection.findOne({ _id: new ObjectId(id) });
            if (item) {
                const dailyTotalsCollection = db.collection('dailyTotals');
                const today = movedDate.slice(0, 10);
                await dailyTotalsCollection.insertOne({
                    date: today,
                    itemId: item._id,
                    projectId: item.projectId || item.project_key || item.projectKey,
                    customer: item.customer,
                    projectName: item.projectName,
                    supplierId: item.supplierId,
                    itemType: item.itemType,
                    modelNumber: item.modelNumber,
                    quantity: item.quantity,
                    itemNumber: item.itemNumber,
                    location: item.location,
                    squareft: item.squareft,
                    weight: item.weight,
                    previousType: item.type,
                    newType: updateData.type,
                    movedDate: movedDate
                });
                log('Inserted dailyTotals:', {
                    date: today,
                    itemId: item._id,
                    projectId: item.projectId || item.project_key || item.projectKey,
                    customer: item.customer,
                    projectName: item.projectName,
                    supplierId: item.supplierId,
                    itemType: item.itemType,
                    modelNumber: item.modelNumber,
                    quantity: item.quantity,
                    itemNumber: item.itemNumber,
                    location: item.location,
                    squareft: item.squareft,
                    weight: item.weight,
                    previousType: item.type,
                    newType: updateData.type,
                    movedDate: movedDate
                });
            }
        }
        const result = await inventoryCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Item not found' });
        res.json({ message: 'Item updated' });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/inventory/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await inventoryCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Item not found' });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

app.delete('/api/inventory/project/:projectKey', async (req, res, next) => {
    try {
        const { projectKey } = req.params;
        await inventoryCollection.deleteMany({
            $or: [
                { projectId: projectKey },
                { project_key: projectKey }
            ]
        });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

// --- FILE UPLOADS & LISTS ---
// Receiving Reports
const rreportStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'rreport')),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const rreportUpload = multer({ storage: rreportStorage });

app.get('/api/rreport/list', (req, res) => {
    const dir = path.join(__dirname, 'public', 'rreport');
    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).json([]);
        const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
        res.json(pdfs);
    });
});
app.post('/api/rreport/upload', rreportUpload.single('file'), (req, res) => {
    res.json({ success: true });
});
app.delete('/api/rreport/delete/:filename', (req, res) => {
    const file = path.join(__dirname, 'public', 'rreport', req.params.filename);
    fs.unlink(file, err => {
        if (err) return res.status(500).json({ error: 'Delete failed' });
        res.json({ success: true });
    });
});

// Purchase Orders
const poStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'po')),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const poUpload = multer({ storage: poStorage });

app.get('/api/po/list', (req, res) => {
    const dir = path.join(__dirname, 'public', 'po');
    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).json([]);
        const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
        res.json(pdfs);
    });
});
app.post('/api/po/upload', poUpload.single('file'), (req, res) => {
    res.json({ success: true });
});
app.delete('/api/po/delete/:filename', (req, res) => {
    const file = path.join(__dirname, 'public', 'po', req.params.filename);
    fs.unlink(file, err => {
        if (err) return res.status(500).json({ error: 'Delete failed' });
        res.json({ success: true });
    });
});

// ========================
// Error Handler
// ========================
app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Internal server error' });
});

// ========================
// Server Startup
// ========================
connectToMongoDB().then(() => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}).catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
});