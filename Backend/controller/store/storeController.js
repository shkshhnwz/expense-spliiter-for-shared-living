const User = require('../../model/User');
const Income = require('../../model/setincome');
const Expense = require('../../model/splitmodel');
const PDFDocument = require('pdfkit');

exports.getdashboard = async (req, res, next) => {
    const userid = req.user && req.user._id;
    if (!userid) {
        return res.redirect('/login');
    }
    try {
        const userDetails = await User.findById(userid);
        if (!userDetails) {
            res.redirect('/login');
        }
        const totalIncomeResult = await Income.aggregate([
            { $match: { user: userid } },
            {
                $group: {
                    _id: null,
                    totalamount: { $sum: "$amount" }
                }
            }
        ])
        const totalIncome = totalIncomeResult.length > 0 ? totalIncomeResult[0].totalamount : 0;
        res.render('store/dashboard', {
            pageTitle: "Home Page",
            stylesheet: "/dashboard.css",
            TotalIncome: totalIncome,
            user: userDetails
        })
    } catch (err) {
        console.log('Error while displaying Total Income');
        next(err);
    }
}

exports.getsetincome = (req, res, next) => {
    res.render('store/setincome', {
        pageTitle: "Set Income Page",
        stylesheet: "/setincome.css",
        user: req.user
    })
}

exports.postsetincome = async (req, res, next) => {
    const userid = req.user && req.user._id;
    if (!userid) {
        res.redirect('/login')
    }

    const {
        amount,
        dateReceived,
        incomeSource,
        description
    } = req.body;

    if (!amount || !dateReceived || !incomeSource) {
        return res.status(400).json({
            message: 'Missing required fields.'
        })
    }
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({
            message: 'Invalid amount.'
        })
    }

    const validSource = ['Salary', 'Freelance', 'BusinessProfit', 'Rental', 'Investment', 'Other'];
    if (!validSource.includes(incomeSource)) {
        return res.status(400).json({
            message: `Invalid Income Source. Must be one the ${validSource.join(', ')}`
        })
    }

    try {
        const newIncome = new Income({
            user: userid,
            amount: amountNum,
            dateReceived: dateReceived,
            incomeSource: incomeSource,
            description: description
        })

        const result = await newIncome.save();
        res.status(201).json({
            message: 'Income record successfully added! ',
            incomerecord: result
        })
    } catch (err) {
        console.error('Error saving new income entry:', err);
        if (err.name === 'ValidationError') {
            return res.status(422).json({
                message: 'Data validation failed.',
                errors: err.errors
            });
        }
        next(err);
    }
}

exports.getsplit = (req, res, next) => {
    res.render('store/split', {
        pageTitle: "Split a bill",
        stylesheet: "/split.css",
        user: req.user
    })
}

exports.postsplit = async (req, res, next) => {
    // Get the authenticated user ID
    const userid = req.user && (req.user._id || req.user.uid);
    if (!userid) {
        return res.redirect('/login');
    }

    const {
        splitName,
        payableAmount,
        dateofExpense,
        splitterNames,
        splitterContact, // This array/string contains only NON-PAYER contacts
        splitValues,
        splitMethod
    } = req.body;

    const amount = parseFloat(payableAmount);
    
    // ----------------------------------------------------------------------
    // 🛑 FIX: Inject the Payer's Contact Information (Securely)
    // ----------------------------------------------------------------------
    // Get Payer's contact from the secure user object
    const payerContact = req.user.email || req.user.contact || 'N/A'; 

    // Ensure submittedContacts is an array and filter out any accidental null/empty string entries
    let submittedContacts = Array.isArray(splitterContact) 
        ? splitterContact.filter(c => c !== null)
        : (splitterContact ? [splitterContact] : []);

    // Add the payer's secure contact to the beginning (index 0).
    submittedContacts.unshift(payerContact);
    const finalSplitterContacts = submittedContacts; 
    // ----------------------------------------------------------------------


    // 1. Validation Check (Uses corrected array and correct path for redirect)
    // Note: The !splitterContact check is now safely handled by checking finalSplitterContacts length
    if (!splitName || isNaN(amount) || !dateofExpense || !splitterNames || !splitValues || !splitMethod) {
        return res.redirect('/dashboard/splits?error=Missing required fields');
    }

    if (amount <= 0) {
        return res.redirect('/dashboard/splits?error=Amount should be greater than zero');
    }

    // 2. Length Mismatch Check (Uses the fixed finalSplitterContacts array)
    if (splitterNames.length !== splitValues.length || splitterNames.length !== finalSplitterContacts.length) {
        return res.redirect('/dashboard/splits?error=Splitter data mismatch');
    }

    let totalValSum = 0;
    const finalsplitters = [];
    
    splitValues.forEach(val => totalValSum += parseFloat(val))

    for (let i = 0; i < splitterNames.length; i++) {
        const value = parseFloat(splitValues[i]);
        let amountOwned = 0;

        switch (splitMethod) {
            case 'equal':
                amountOwned = amount / splitterNames.length;
                break;
            case 'amount':
                amountOwned = value;
                break;
            case 'percentage':
                amountOwned = (amount * value) / 100
                break;
            case 'shares':
                if (totalValSum === 0) {
                    return res.redirect('/dashboard/splits?error=Shares total cannot be zero');
                }
                amountOwned = amount * (value / totalValSum);
                break;
            default:
                return res.redirect('/dashboard/splits?error=Invalid split method');
        }
        
        finalsplitters.push({
            name: splitterNames[i],
            contact: finalSplitterContacts[i], // Uses the securely injected contact
            amountOwned: amountOwned,
            splitValue: value,
            hasSettled: false
        });

    }
    
    const calculatedTotalOwed = finalsplitters.reduce((sum, splitter) => sum + splitter.amountOwned, 0);

    if (Math.abs(calculatedTotalOwed - amount) > 0.01) {
        return res.redirect('/dashboard/splits?error=Split amounts do not total the expense amount.');
    }

    try {
        const newExpense = new Expense({
            description: splitName,
            amount: amount,
            date: dateofExpense,
            paidBy: userid, 
            splitMethod: splitMethod,
            splitters: finalsplitters,
            user : userid 
        });

        await newExpense.save();
        
        return res.redirect('/dashboard'); 

    } catch (err) {
        console.error('Error saving new expense:', err);
        next(err); 
    }
} 

exports.downloadpdf = async(req, res, next) =>{
    const {expenseId} = req.params;
    const userid = req.user && (req.user._id || req.user.uid);
    if (!userid) {
        return res.redirect('/login');
    }
    
    const expense = await Expense.findOne({_id : expenseId, user: userid})

    if(!expense){
        return res.status(404).send('Expense not found or unauthorized.').res.redirect('./split');
    }
}