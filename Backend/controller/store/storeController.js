const User = require('../../model/User');
const Income = require('../../model/setincome');


exports.getdashboard = async (req, res, next) => {
    const userid = req.user && req.user._id;
    if (!userid) {
        return res.redirect('/login');
    }
    try {
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
            TotalIncome: totalIncome
        })
    } catch (err) {
        console.log('Error while displaying Total Income');
        next(err);
    }
}

exports.getsetincome = (req, res, next) => {
    res.render('store/setincome', {
        pageTitle: "Set Income Page",
        stylesheet: "/setincome.css"
    })
}

exports.postsetincome = async (req, res, next) => {
    const userid = req.user && req.user._id;
    if (!userid) {
        return res.status(401).json({
            message: 'Unauthorized. Please ensure you are logged in.'
        });
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