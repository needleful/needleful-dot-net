"use strict";
function getPositions(text, ...indeces) {
	let result = {};
	let keys = Array.from(indeces).sort();
	let column = 0, line = 0, next_result = 0;
	for(let c = 0; c < text.length && next_result < keys.length; c++){
		while(c == keys[next_result]) {
			result[keys[next_result]] = {line:line, column:column};
			next_result++;
		}
		if(text[c] == '\n'){
			column = 0;
			line ++;
		}
		else {
			column ++;
		}
	}
	// Beyond the end of the text
	for(; next_result < keys.length; next_result++) {
		result[keys[next_result]] = {line:line, column:column};
	}
	return indeces.map(i => result[i]);
}

function parseAlgol(text, options = {}) {
	if(!text || !text.length) {
		perr(0, "Your program is empty!");
	}
	const Pc = {
		begin: 'begin',
		end: 'end',
		comment: 'comment',
		own: 'own',
		types: ['real', 'integer', 'Boolean'],
		procedure: 'procedure',
		value: 'value',
		semicol: ';',
		statementEnd: /^(;|end)/,
		cond_if: 'if',
		cond_then: 'then',
		cond_else: 'else',
		comma: ',',
		assign: ':=',
		parenOpen: '(',
		parenClose: ')',
		colon: ':',
		postComment: /^([^;]*)/,
		identPart: /^\p{Alpha}[\p{Alpha}\d]*/u,
		letterString: /^\p{Alpha}+/u,
		ofType:/^(real|integer|Boolean)/,
		anyToken:/^\S+/,
		sign:/^(\+|-)/,
		decimal:'.',
		digits: /^\d+/,
		exponent:'_e',
		typelessProc: 'void', // Just for internal validation
		signedExponent: /^_e(\+|-)?/,
		logicalVal:/^(true|false)/,
		// Binary operators
		logicOps:[ 'is', 'implies', 'or', 'and',],
		logicalNot: 'not',
		relationOps:['<', '<=', '>=', '>', '!=', '='],
		arithmeticOps:['+','-','*','/','%','^'],
	};
	const keywords = Object.values(Pc).flat().filter(e => typeof(e) == 'string');
	const opPrecedence = {
		is:9, implies:8, or:7, and:6, not:5,
		'<':4, '<=':4, '>=':4, '>':4, '=':4, '!=':4,
		'+':3, '-':3,
		'*':2, '/':2, '%':2, '^':1, primary:0
	};
	const allOps = Pc.logicOps.concat(Pc.relationOps).concat(Pc.arithmeticOps).concat(Pc.logicalNot);

	function opResultType(op) {
		if(Pc.arithmeticOps.includes(op)) {
			return 'numeric';
		}
		else if(Pc.logicOps.includes(op) || op == Pc.logicalNot) {
			return 'Boolean';
		}
		else if(Pc.relationOps.includes(op)) {
			return 'Boolean';
		}
	}
	function opInputType(op) {
		if(Pc.arithmeticOps.includes(op)) {
			return 'numeric';
		}
		else if(Pc.logicOps.includes(op) || op == Pc.logicalNot) {
			return 'Boolean';
		}
		else if(Pc.relationOps.includes(op)) {
			return 'numeric';
		}
	}
	function compatible(type1, type2) {
		if (type1 == 'any' || type2 == 'any') {
			return true;
		}
		else {
			return type1 == type2;
		}
	}

	function perr(location, message) {
		console.trace();
		let [loc] = getPositions(text, location);
		throw {text:message, location:loc};
	}

	function pwarn(location, message) {
		let [loc] = getPositions(text, location);
		console.log("Warning: ", message, "at: ", loc);
	}

	let c = 0;

	function good() {
		return c < text.length;
	}

	function identifier() {
		let identStart = c, identEnd = c;
		let word = grab(Pc.identPart);
		if(!word) {
			return null;
		}
		if(keywords.includes(word)) {
			backtrack(word);
			return null;
		}
		let wordParts = 1;
		while(good()) {
			let w2 = grab(Pc.identPart);
			if(w2) {
				if(keywords.includes(w2)) {
					backtrack(w2);
					break;
				}
				identEnd = c;
				word += w2;
				wordParts += 1;
			}
			else {
				break;
			}
		}
		if(wordParts > 1) {
			if(options.warnOnWhitespaceName) {
				pwarn(c, `Identifier contains whitespace. Reading as {${word}}`);
			}

			let [start, end] = getPositions(text, identStart, identEnd);
			if(start.line < end.line) {
				let message = `Identifier {${word}} spans multiple lines. Are you missing a semicolon?`;
				if(options.multiLineIdentifiers) {
					pwarn(c, message);
				}
				else {
					perr(c, message)
				}
			}
		}
		return word;
	}

	function simpleExpression() {
		let start = c;
		let left = null;

		function getPlacement(tree, precedence) {
			let parent = null;
			while(tree && tree.precedence >= precedence) {
				tree = tree.right;
			}
			return [parent, tree];
		}
		function rightmost() {
			let n = left
			while(n && n.right) {
				n = n.right;
			}
			return n;
		}
		function fail() {
			c = start;
			return null;
		}

		let s = grab(Pc.sign) || grab(Pc.logicalNot);
		if(s) {
			left = {op: s, precedence: opPrecedence[s], type: opResultType(s), context:c};
		}
		while(good()) {
			let earlyOp = grabFirst(allOps);
			while(earlyOp) {
				if(earlyOp == Pc.logicalNot) {
					let exp = {op: earlyOp, precedence: opPrecedence[earlyOp], type: opResultType(earlyOp), context: c};
					let [top, _ignore] = getPlacement(left, exp.precedence);
					if(top) {
						top.right = exp;
					}
					else {
						left = exp;
					}
				}
				else if (!left) {
					perr(c, `Unexpected operator {${earlyOp}} at the start of an expression.`);
				}
				else {
					perr(c, `Unexpected operator {${earlyOp}} following {${rightmost().op}}`)
				}
				earlyOp = grabFirst(allOps);
			}
			let val = primary();
			if(!val) {
				if(!left) {
					return fail();
				}
				else {
					perr(c, `Expected a value or expression after operator {${left.op}}. Found {${grab(Pc.anyToken)}}`);
				}
			}
			else {
				if(!left) {
					left = val;
				}
				else {
					rightmost().right = val;
				}
			}
			let op = grabFirst(allOps);
			if(!op) {
				return left;
			}
			let prec = opPrecedence[op];
			let opNode = {op: op, precedence: prec, type: opResultType(op), context:c};

			let [top, opleft] = getPlacement(left, prec);
			let inType = opInputType(op);
			if(!compatible(opleft.type, inType)) {
				perr(c, `Operator {${op}}, of type ${inType}, is not compatible with expression ${JSON.stringify(opleft)} of type ${opleft.type}`)
			}
			opNode.left = opleft;
			if(top == null){
				left = opNode;
			}
			else {
				top.right = opNode;
			}
			// Validate right-hand assignments once a subtree is completed (by moving to the left-hand side).
			let r = opleft;
			while(r && r.right) {
				let rin = opInputType(r.op);
				let rout = r.right.type;
				if(!compatible(rin, rout)) {
					perr(r.right.context, `Operator {${r.op}} requires a value of type ${rin}, but expression is of type ${rout}`);
				}
				r = r.right;
			}
		}
		perr(c, 'File ended unexpectedly while parsing an expression.');
	}

	function ifClause() {
		if(grab(Pc.cond_if)) {
			let condition = expect(expression(), `Expected an expression after {if}`);
			if(!compatible(condition.type, 'Boolean')) {
				perr(condition.context, 
					`Expected a Boolean expression for the {if} clause, found an incompatible ${condition.type} expression`);
			}
			return condition;
		}
		else {
			return null;
		}
	}

	function number() {
		function digits() {
			let val = '';
			while(peek(Pc.digits)) {
				val += grab(Pc.digits);
			}
			return val.length? val : null;
		}

		let uint = digits();
		let decimal = grab(Pc.decimal);
		let lowDigits = decimal ? 
			expect(digits(), 'Digits are always expected after a decimal point') 
			: digits();
		let exp = grab(Pc.signedExponent);
		let expDigits = exp ? 
			expect(digits(), 'A value is required for the exponent') 
			: digits();

		if(!uint && !lowDigits && !expDigits) {
			return null;
		}

		let val = [uint, decimal, lowDigits, exp, expDigits].filter(e => e).join('');
		if(exp && !uint && !lowDigits) {
			val = val.replace(Pc.exponent, '1'+Pc.exponent);
		}
		let result = Number(val.replace(Pc.exponent, 'e'));
		if(isNaN(result)) {
			perr(c, `PARSER BUG: Not a valid number: {${val}}`);
		}
		return {type:'numeric', value: result, precedence: opPrecedence.primary, context:c};
	}

	function primary() {
		if(grab(Pc.parenOpen)) {
			let e = expect(expression(), 'Expected an expression after an opening parenthesis');
			grabOrDie(Pc.parenClose, 'Expected a closing parenthesis after a nested expression');
			e.precedence = opPrecedence.primary;
			return e;
		}
		let val = grab(Pc.logicalVal);
		if(val) {
			return {type: 'Boolean', value:Boolean(val), precedence:opPrecedence.primary, context:c};
		}
		val = identifier();
		if (val) {
			if(grab(Pc.parenOpen)) {
				let pcall = expect(procDesignator(val, expression, 'procedure call'), `Expected a prodecure call after { ${val}( }`);
				pcall.type = 'any';
				pcall.precedence = opPrecedence.primary;
				return pcall;
			}
			else {
				return {type:'any', variable:val, precedence: opPrecedence.primary, context:c};
			}
		}
		else {
			return number();
		}
	}

	function ifElse() {
		let lif = ifClause();
		if(lif) {
			grabOrDie(Pc.cond_then);
			let then_do = expect(simpleExpression(), `No condition after then-clause for conditional expression`);
			grabOrDie(Pc.cond_else, "{else} clause is mandatory for conditional expressions.");
			let else_do = expect(expression(), `No expression found after {else}`);

			if(!compatible(then_do.type, else_do.type)) {
				perr(then_do.context, `Expressions of if-else statement have incompatible types: ${then_do.type} versus ${else_do.type}`)
			}

			let strict_type = then_do.type == 'any'? else_do.type : then_do.type;
			return {
				cond:lif, 
				then_do:then_do, 
				else_do:else_do,
				type: strict_type
			};
		}
		else {
			return simpleExpression();
		}
	}

	function expression() {
		return ifElse(simpleExpression, expression);
	}

	function specifier() {
		let result = {};
		let type = grab(Pc.ofType);
		if(type) {
			if(grab(Pc.procedure)) {
				result.proc_type = type;
			}
			else {
				result.type = type;
			}
		}
		else if(grab(Pc.ofType)) {
			result.proc_type = Pc.typelessProc;
		}
		else {
			return null;
		}
		result.values = listOf(identifier, 'parameter specifier');
		expect(result.values.length, 'Expected identifiers after specifier');
		return result;
	}

	function procDeclaration(type) {
		let name = expect(identifier(), 'Procedure does not have a name');
		let designator, values = [], specifiers = [], body = null;

		if(grab(Pc.parenOpen)) {
			designator = expect(procDesignator(name, identifier, 'procedure declaration'), "Procedure does not have a proper header");
		}
		else {
			designator = {args:[], delimiters:[]};
		}
		grabOrDie(Pc.semicol, 'Semicolon required after procedure header');
		if(grab(Pc.value)) {
			values = listOf(identifier, 'value parameters');
			expect(values.length, 'Expected identifiers after {value}');
			grabOrDie(Pc.semicol, 'Semicolon required after value parameters');
		}
		specifiers = listOf(specifier, 'specifier list', Pc.semicol);
		if(specifiers && specifiers.length) {
			grabOrDie(Pc.semicol, 'Semicolon required after last specifier.');
		}
		body = statement();
		grabOrDie(Pc.semicol, 'Semicolon required after function body' + (body? '' : ' (even an empty body)'));

		return {
			type: type,
			proc: name,
			parameters: designator.args,
			delimiters: designator.delimiters,
			specifiers: specifiers,
			values: values,
			body: body
		}
	}

	function listOf(item, description, delimiter = Pc.comma, end = Pc.semicol, allowEmpty = false, specialFailure = null, endOnBackTrack = false) {
		let result = [];
		let ended = false;
		let start = c;
		let implicitEnd = delimiter == end;
		function unexpectedEnd() {
			perr(c, `File ended in the middle of a ${description}. Are you missing {${end}}?`);
		}
		while(good()) {
			if(!implicitEnd && peek(end)) {
				ended = true;
				break;
			}
			else if(grab(delimiter)) {
				if(allowEmpty) {
					continue;
				}
				else if(implicitEnd && !result.length) {
					return null;
				}
				else {
					perr(c, `Cannot have empty items or extra {${delimiter}} in ${description}`);
				}
			}
			let nextItem = item();
			if(!nextItem) {
				if(!result.length) {
					return null;
				}
				else if(implicitEnd) {
					backtrack(delimiter);
					ended = true;
					break;
				}
				else if(peek(end)) {
					ended = true;
					break;
				}
				else if(endOnBackTrack) {
					ended = true;
					break;
				}
				else if (!specialFailure || !specialFailure()) {
					let next = grab(Pc.anyToken);
					if(next) {
						perr(c, `Unexpected text in ${description}: {${next}}. Expected {${delimiter}} to continue or {${end}} to end it.`);
					}
					else {
						unexpectedEnd();
					}
				}
			}
			result.push(nextItem);

			if(!implicitEnd && peek(end)) {
				ended = true;
				break;
			}
			else {
				grab(delimiter);
				if(!delimiter) {
					perr(c, `Expected {${delimiter}} or {${end}} in ${description}. Got {${grab(Pc.anyToken)}}`);
				}
			}
		}
		if(!ended){
			unexpectedEnd();
		}
		return result;
	}

	function typeDeclaration(type, own = false) {
		if(grab(Pc.procedure)) {
			expect(!own, `The 'own' specifier is invalid for procedures.`);
			return procDeclaration(type);
		}
		let vars = listOf(identifier, 'type declaration list');
		if(!vars.length) {
			perr(c, `Declarations list can't be empty`);
		}
		return {decl: type, own: own, vars:vars};
	}

	function assignment(firstVar) {
		let list = [firstVar].concat(
			listOf(expression, 'assignment list', Pc.assign, Pc.statementEnd, false, null, true));
		if(list.length < 2) {
			perr(c, `No value assigned to {${firstVar}}`);
		}
		for(let i = 0; i < list.length - 1; i++){ 
			if(!('variable' in list[i])) {
				perr(c, `Only variables can be assigned to, not expressions like ${JSON.stringify(list[i])}.`);
			}
		}
		let value = list.pop();
		return {
			vars:list.map(e => e.variable),
			assign:value
		}
	}

	function declaration() {
		let start = c;
		if(grab(Pc.own)) {
			let next = expect(grab(Pc.ofType), 
				`Expected one of [${Pc.types}] after {own}. Found {${next}}`)
			return typeDeclaration(next, true);
		}
		let type = grab(Pc.ofType);
		if(type) {
			if(grab(Pc.procedure)) {
				return procDeclaration(type);
			}
			else {
				return typeDeclaration(type);
			}
		}
		if(grab(Pc.procedure)) {
			return procDeclaration(Pc.typelessProc);
		}
		// Backtrack and cancel
		c = start;
		return null;
	}

	function blockHead() {
		return listOf(declaration, 'block declarations', Pc.semicol, Pc.semicol, false, () => {
			if(statement()) {
				perr(c, 'Expected a semicolon after declarations.');
				return true;
			}
			else {
				return false;
			}
		});
	}

	// This assumes the opening bracket has been grabbed
	function procDesignator(name, arg, description) {
		let result = {func: name, args: []};
		if(grab(Pc.parenClose)) {
			pwarn(c, 'Procedures with no arguments do not have empty brackets: ()');
			return result;
		}
		while(good()) {
			if(grab(Pc.comma)) {
				perr(c, 'Extra comma (or missing value) in arguments list');
			}
			let argument = arg();
			if(!argument) {
				perr(c, `Expected another argument or closing parenthesis for procedure call {${name}}`);
			}
			result.args.push(argument);
			if(grab(Pc.comma)) {
				continue;
			}
			else if(grab(Pc.parenClose)) {
				let beforeLongComma = c;
				let longComma = grab(Pc.letterString);
				if(!longComma || keywords.includes(longComma)) {
					backtrack(longComma);
					break;
				}
				else if(!grab(Pc.colon) || !grab(Pc.parenOpen)) {
					let [before, after] = getPositions(text, beforeLongComma, c);
					if (before.line < after.line) {
						perr(c, `A missing semicolon after ${description}, presumably.`);
					}
					perr(c, `Did you mean to write { ) ${longComma}:( } as a long comma, or are you missing separator to end the ${description}?`)
				}
				if(!result.delimiters) {
					result.delimiters = [];
				}
				result.delimiters.push({
					longComma: longComma, 
					position: result.args.length
				});
				continue;
			}
		}
		return result;
	}

	function statement() {
		if(grab(Pc.own) || grab(Pc.ofType)) {
			perr(c, "Cannot declare new variables in a statement");
		}
		else if(grab(Pc.begin)) {
			let head = blockHead();
			let tail = blockTail();
			return {head:head, tail:tail};
		}
		else if (grab(Pc.comment)) {
			let comment = grab(Pc.postComment);
			return {comment:comment};
		}
		else if(grab(Pc.cond_if)) {
			let cond = expect(boolean(), 'Expected a boolean expression after {if}');
			grabOrDie(Pc.cond_then, '{then} is required after {if <condition>}');
			let s = expect(statement(), 'Expected a statement after if-then clause');
			if(grab(Pc.cond_else)) {
				let s2 = expect(statement(), 'Expected a statement after {else}');
				return {cond: cond, then_do: s, else_do: s2};
			}
			else {
				return {cond: cond, then_do: s};
			}
		}

		let exp = expression();
		if(!exp) {
			return null;
		}
		else if(grab(Pc.assign)) {
			return assignment(exp);
		}
		else if('variable' in exp) {
			return {func: exp.variable, args: []};
		}
		else if(typeof(exp) != 'object' || !('func' in exp)) {
			perr(c, `Standalone expressions are not allowed: ${JSON.stringify(exp)}`);
		}
		return exp;
	}

	function blockTail() {
		let block = listOf(statement, 'statement list', Pc.semicol, Pc.end, true);
		let comment = grab(Pc.postComment);
		if(comment.indexOf('\n') >= 0 && comment.indexOf('end') >= 0) {
			pwarn(c, `Comment after 'end' extends more than one line. Is that intentional?`);
		}
		return block;
	}

	function skipWhiteSpace(){
		while(c < text.length && text[c].match(/\s/)) {
			c++;
		}
	}

	// Match string or regex
	// Regexes should have ^ at the front
	function peek(query) {
		skipWhiteSpace();
		if(typeof(query) == 'string') {
			return text.startsWith(query, c) ? query : null;
		}
		else {
			let m = text.substr(c).match(query);
			return m? m[0] : null; 
		}
	}

	// peek at the token, and advance if it exists.
	function grab(query) {
		let r = peek(query);
		if(r) {
			c += r.length;
		}
		return r;
	}

	function grabFirst(queries) {
		for(let q of queries) {
			let r = grab(q);
			if(r) {
				return r;
			}
		}
		return null;
	}

	function grabOrDie(query, error) {
		var g = grab(query);
		if (!g) {
			perr(c, `Expected token {${query}} found {${grab(Pc.anyToken)}}. ${error? error : ""}`);
		}
		return g;
	}

	function expect(expression, error) {
		if(!expression) {
			perr(c, error);
		}
		return expression;
	}

	function backtrack(token) {
		if(!token) {
			return;
		}
		c = text.substr(0, c).lastIndexOf(token);
	}

	grabOrDie(Pc.begin, "Keyword {begin} is required at the start of a program.");
	let head = blockHead();
	let tail = blockTail();
	if(!grab(Pc.semicol)) {
		pwarn(c, "Make sure to end your program with a semicolon");
	}
	return {head: head, tail: tail};
}
