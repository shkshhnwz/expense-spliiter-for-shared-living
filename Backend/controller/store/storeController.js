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
        // Make sure you have imported PDFDocument (e.g., const PDFDocument = require('pdfkit');)
        // and your Mongoose models (Expense, User).
        
        const userid = req.user && (req.user._id || req.user.uid);
        if (!userid) return res.redirect('/login');

        const expense = await Expense.findOne({ _id: expenseId, user: userid });
        if (!expense) return res.status(404).send("Not found or unauthorized");

        const payer = await User.findById(expense.paidBy);
        const payerName = payer?.name || payer?.displayName || "Payer";
        const payerContact = payer?.email || payer?.contact || "N/A";

        // Update the payer's info in the splitters array if they are the first entry
        if (expense.splitters.length > 0) {
            // Assuming the first splitter is the payer, as per your original logic
            expense.splitters[0].name = payerName;
            expense.splitters[0].contact = payerContact;
        }

        const filename = `Expense_${expense._id}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        const doc = new PDFDocument({ margin: 30 });
        doc.pipe(res);

        // --- Layout Constants ---
        const P = 30; // Margin
        const W = doc.page.width - P * 2; // Usable width
        const X_START = P;
        const LINE_HEIGHT_GUESS = 18; // Standard vertical space for a single line

        // 1. Title
        doc.fontSize(24).font('Helvetica-Bold').text(`Expense Split: ${expense.description}`, { align: "center" });
        doc.moveDown(); // Space after title

        // 2. Metadata (Using explicit X/Y for reliable alignment)
        doc.fontSize(12).font('Helvetica');
        const metaY = doc.y; // Capture the starting Y position

        // Left Column
        doc.text(`Date: ${new Date(expense.date).toLocaleDateString()}`, X_START, metaY);
        doc.text(`Paid By: ${payerName}`, X_START, metaY + LINE_HEIGHT_GUESS);

        // Right Column
        const rightColX = P + W * 0.5; // Start halfway across
        const rightColW = W * 0.5; // Width for right column
        
        doc.text(`Total Amount: Rs. ${expense.amount.toFixed(2)}`, rightColX, metaY, { align: "right", width: rightColW });
        doc.text(`Split Method: ${expense.splitMethod}`, rightColX, metaY + LINE_HEIGHT_GUESS, { align: "right", width: rightColW });

        // Advance cursor past the metadata block
        doc.y = metaY + LINE_HEIGHT_GUESS * 2 + 10; 
        doc.moveDown();

        // 3. Table Structure Definition
        const cols = [
            { title: "Name", x: P, w: W * 0.25 },
            { title: "Contact", x: P + W * 0.25, w: W * 0.30 },
            { title: "Share/Value", x: P + W * 0.55, w: W * 0.20 },
            { title: "Amount Owed", x: P + W * 0.75, w: W * 0.25 }
        ];

        // Function to draw the table header
        const drawHeader = (doc, cols, P, W) => {
            doc.font("Helvetica-Bold").fontSize(11);
            const headerY = doc.y;
            cols.forEach(c => doc.text(c.title, c.x, headerY, { width: c.w }));
            doc.moveDown(0.5); 
            doc.moveTo(P, doc.y).lineTo(doc.page.width - P, doc.y).stroke(); // Separator line
            doc.font("Helvetica").fontSize(10);
            doc.moveDown(0.2); // Small space before first row
        };
        
        // Initial Header
        drawHeader(doc, cols, P, W);

        // 4. Rows 
        const ROW_PADDING = 6;
        const bottomMargin = 60; // Space for footer

        for (let i = 0; i < expense.splitters.length; i++) {
            const s = expense.splitters[i];
            
            // Check for page break
            const estRowHeight = 40; // Conservative estimate for max row height
            if (doc.y > doc.page.height - bottomMargin - estRowHeight) {
                doc.addPage();
                drawHeader(doc, cols, P, W); // Redraw header on new page
            }
            
            // Compose display values
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

            doc.font("Helvetica").fontSize(10); // Ensure current font settings for height calculation

            const nameText = s.name || "N/A";
            const contactText = s.contact || "N/A";
            const shareText = sv;
            const owedText = owed;
            
            // Measure heights for each cell with the column width
            const hName = doc.heightOfString(nameText, { width: cols[0].w });
            const hContact = doc.heightOfString(contactText, { width: cols[1].w });
            const hShare = doc.heightOfString(shareText, { width: cols[2].w });
            const hOwed = doc.heightOfString(owedText, { width: cols[3].w });

            const maxCellHeight = Math.max(hName, hContact, hShare, hOwed);
            const startY = doc.y;

            // Draw each cell using the explicit starting Y (startY)
            doc.text(nameText, cols[0].x, startY, { width: cols[0].w, continued: false });
            doc.text(contactText, cols[1].x, startY, { width: cols[1].w, continued: false });
            doc.text(shareText, cols[2].x, startY, { width: cols[2].w, continued: false });
            doc.text(owedText, cols[3].x, startY, { width: cols[3].w, align: "right", continued: false });

            // Calculate the Y position for the next row
            const nextY = startY + maxCellHeight + ROW_PADDING; 
            
            // Draw a thin separator line under the row
            doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(P, nextY - 1).lineTo(doc.page.width - P, nextY - 1).stroke();

            // Advance cursor to start of the next row
            doc.y = nextY;
        }

        // --- FOOTER AT BOTTOM ---
        const footerText = "Generated by ExpenseCare: Expense Splitter For Shared Living";
        const footerY = doc.page.height - 50;
        
        // Ensure there is enough space for the footer
        if (doc.y + 40 > footerY) {
            doc.addPage();
        }

        // Draw a separator line above the footer
        const sepY = doc.page.height - 70;
        doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(P, sepY).lineTo(doc.page.width - P, sepY).stroke();
        
        // Draw footer text
        doc.fillColor('gray').fontSize(10);
        doc.text(footerText, 0, footerY, { align: "center" });

        doc.end();

    } catch (err) {
        console.error("Error generating PDF:", err);
        res.status(500).send("PDF generation failed");
        // next(err); 
    }
};


exports.getsplithistroy = async (req, res, next) => {

    Expense.find().then((newExpense) => {
        res.render('store/mysplithistory', {
            newExpense: newExpense,
            pageTitle: "Histroy of Splits",
            stylesheet: "/mysplithistory.css",
            user: req.user
        })
    })

}