const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groupSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['Apartment', 'Trip', 'Other'],
        default: 'Other'
    },
    // CHANGED: Members is now an array of objects, not just IDs
    members: [{
        _id: false, // Disable auto-ID for subdocs if not needed, or keep true
        name: { type: String, required: true },
        contact: { type: String }, // Phone or Email
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            required: false // Optional: Only set if they are a registered user
        }
    }],
    budget: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);