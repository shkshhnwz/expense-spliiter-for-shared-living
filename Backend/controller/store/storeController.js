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
    try {
        const userid = req.user && (req.user._id || req.user.uid);
        if (!userid) return res.redirect('/login');

        const {
            splitName,
            payableAmount,
            dateofExpense,
            splitterNames,
            splitterContact,
            splitValues,
            splitMethod
        } = req.body;

        const amount = parseFloat(payableAmount);

        if (!splitName || isNaN(amount) || amount <= 0 || !dateofExpense || !splitMethod)
            return res.redirect('/dashboard/splits?error=Invalid data');

        // Convert inputs to arrays if not already
        const namesArr = Array.isArray(splitterNames) ? splitterNames : [splitterNames];
        const contactArr = Array.isArray(splitterContact) ? splitterContact : [splitterContact];
        const valuesArr = Array.isArray(splitValues) ? splitValues : [splitValues];

        if (namesArr.length !== contactArr.length || namesArr.length !== valuesArr.length)
            return res.redirect('/dashboard/splits?error=Invalid array lengths');

        // Payer details
        const payerName = req.user.name || req.user.displayName || "Payer";
        const payerContact = req.user.email || req.user.contact || "N/A";

        const finalSplitters = [];

        // Insert payer as first participant
        finalSplitters.push({
            name: payerName,
            contact: payerContact,
            amountOwned: 0,
            splitValue: 0,
            hasSettled: true
        });

        // SUM for shares / percentage modes
        let totalValueSum = 0;
        valuesArr.forEach(v => {
            const num = parseFloat(v);
            if (!isNaN(num)) totalValueSum += num;
        });

        // Process all other participants
        for (let i = 0; i < namesArr.length; i++) {
            const name = namesArr[i];
            const contact = contactArr[i] || "N/A";
            const rawVal = parseFloat(valuesArr[i]) || 0;

            let amountOwned = 0;
            let splitValToStore = rawVal;

            switch (splitMethod) {

                case "equal":
                    amountOwned = amount / (namesArr.length + 1); // include payer
                    splitValToStore = 1;
                    break;

                case "amount":
                    amountOwned = rawVal;
                    break;

                case "percentage":
                    amountOwned = (amount * rawVal) / 100;
                    break;

                case "shares":
                    if (totalValueSum === 0)
                        return res.redirect('/dashboard/splits?error=Share total cannot be zero');

                    amountOwned = amount * (rawVal / totalValueSum);
                    break;

                default:
                    return res.redirect('/dashboard/splits?error=Invalid split method');
            }

            finalSplitters.push({
                name,
                contact,
                amountOwned,
                splitValue: splitValToStore,
                hasSettled: false
            });
        }

        // Validate total
        const totalCalc = finalSplitters.reduce((n, s) => n + s.amountOwned, 0);
        if (Math.abs(totalCalc - amount) > 0.01)
            return res.redirect('/dashboard/splits?error=Split total mismatch');

        // Save
        const newExpense = new Expense({
            description: splitName,
            amount,
            date: dateofExpense,
            paidBy: userid,
            splitMethod,
            splitters: finalSplitters,
            user: userid
        });

        await newExpense.save();
        return res.redirect('/dashboard/mysplithistory');

    } catch (err) {
        console.error("Error in postsplit:", err);
        next(err);
    }
};




exports.downloadpdf = async (req, res, next) => {
    try {
        const { expenseId } = req.params;
        const userid = req.user && (req.user._id || req.user.uid);
        if (!userid) return res.redirect('/login');

        const expense = await Expense.findOne({ _id: expenseId, user: userid });
        if (!expense)
            return res.status(404).send("Not found or unauthorized");

        // Fetch payer details
        const payer = await User.findById(expense.paidBy);
        const payerName = payer?.name || payer?.displayName || "Payer";
        const payerContact = payer?.email || payer?.contact || "N/A";

        // Update the stored payer row in splitters so PDF always uses real values
        if (expense.splitters.length > 0) {
            expense.splitters[0].name = payerName;
            expense.splitters[0].contact = payerContact;
        }

        const filename = `Expense_${expense._id}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        const doc = new PDFDocument();
        doc.pipe(res);

        // Title
        doc.fontSize(24).text(`Expense Split: ${expense.description}`, { align: "center" });
        doc.moveDown();

        // Metadata
        doc.fontSize(12)
            .text(`Date: ${new Date(expense.date).toLocaleDateString()}`, { continued: true })
            .text(`Total Amount: Rs. ${expense.amount.toFixed(2)}`, { align: "right" });

        doc.text(`Paid By: ${payerName}`, { continued: true })
            .text(`Split Method: ${expense.splitMethod}`, { align: "right" });
        doc.moveDown();

        // Table headers
        const P = 30;
        const W = doc.page.width - P * 2;

        const cols = [
            { title: "Name", x: P, w: W * 0.25 },
            { title: "Contact", x: P + W * 0.25, w: W * 0.30 },
            { title: "Share/Value", x: P + W * 0.55, w: W * 0.20 },
            { title: "Amount Owed", x: P + W * 0.75, w: W * 0.25 }
        ];

        doc.font("Helvetica-Bold").fontSize(11);
        cols.forEach(c => doc.text(c.title, c.x, doc.y, { width: c.w }));
        doc.moveDown(0.3);
        doc.moveTo(P, doc.y).lineTo(doc.page.width - P, doc.y).stroke();

        doc.font("Helvetica").fontSize(10);

        // Rows
        expense.splitters.forEach(s => {
            const y = doc.y;

            const sv = !isNaN(parseFloat(s.splitValue))
                ? (expense.splitMethod === "amount"
                    ? `Rs. ${parseFloat(s.splitValue).toFixed(2)}`
                    : (expense.splitMethod === "percentage"
                        ? `${parseFloat(s.splitValue)}%`
                        : `${parseFloat(s.splitValue)}`))
                : "N/A";

            const owed = !isNaN(parseFloat(s.amountOwned))
                ? `Rs. ${parseFloat(s.amountOwned).toFixed(2)}`
                : "N/A";

            doc.text(s.name, cols[0].x, y, { width: cols[0].w });
            doc.text(s.contact, cols[1].x, y, { width: cols[1].w });
            doc.text(sv, cols[2].x, y, { width: cols[2].w });
            doc.text(owed, cols[3].x, y, { width: cols[3].w, align: "right" });

            doc.moveDown(0.8);
        });

        doc.end();

    } catch (err) {
        console.error("Error generating PDF:", err);
        res.status(500).send("PDF generation failed");
        next(err);
    }
};


exports.getsplithistroy = async(req,res,next)=>{

    Expense.find().then((newExpense)=>{
        res.render('store/mysplithistory', {
        newExpense : newExpense,
        pageTitle: "Histroy of Splits",
        stylesheet: "/mysplithistory.css",
        user: req.user
    })
    })

}