
function parseAlgol(text, options = {}) {
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
		// From highest to lowest in the parsing tree, binary ops only
		logicOps:[
			// Logical operators
			'is', // Logical equivalence, not numeric equality
			'implies', // Implication
			'or', 
			'and',
		],
		logicalNot: 'not',
		relationOps:/^(<|<=|=|>=|>|!=)/,
		arithmeticOps:[
			// Arithmetic
			/^(\+|-)/,	
			/^(\*|\/|%)/,
			/^\^/
		],
	};
	const keywords = Object.values(Pc).flat().filter(e => typeof(e) == 'string');

	function getPositions(...indeces) {
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

	function perr(location, text) {
		console.trace();
		let [loc] = getPositions(location);
		throw {text:text, location:loc};
	}

	function pwarn(location, text) {
		let [loc] = getPositions(location);
		console.log("Warning: ", text, "at: ", loc);
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

			let [start, end] = getPositions(identStart, identEnd);
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

	function parseBinary(ops, top, primary, index = 0) {
		let start = c;
		function fail() {
			c = start;
			return null;
		}
		if(index >= ops.length) {
			return primary();
		}
		let op = ops[index];

		let extra_op = grab(op)
		if(extra_op) {
			perr(c, `Extra operator found: {${extra_op}}`);
		}

		let lhs;
		if(grab(Pc.parenOpen)) {
			lhs = top();
			if(lhs === null) {
				return fail();
			}
			grabOrDie(Pc.parenClose, 'Expected a closing parenthesis for the nested expression');
		}
		else{
			lhs = parseBinary(ops, top, primary, index + 1);
		}
		if(lhs === null) {
			return fail();
		}

		let foundOp = grab(op);
		if(foundOp) {
			let rhs = parseBinary(ops, top, primary, index);
			if (rhs === null) {
				perr(c, `Missing the right-hand side of {${foundOp}}. Found {${grab(Pc.anyToken)}}`);
			}
			return {
				op: foundOp, 
				left:lhs, 
				right: rhs
			};
		}
		else {
			return lhs;
		}
	}

	function ifClause() {
		if(grab(Pc.cond_if)) {
			let condition = expect(boolean(), `Expected a boolean expression after {if}`);
			return condition;
		}
		else {
			return null;
		}
	}

	function digits() {
		let val = '';
		while(peek(Pc.digits)) {
			val += grab(Pc.digits);
		}
		return val.length? val : null;
	}

	function arithmeticPrimary() {
		let val = identifier();
		if (val) {
			if(grab(Pc.parenOpen)) {
				return procDesignator(val, expression, 'procedure call');
			}
			else {
				return val;
			}
		}
		else {
			let uint = digits();
			let decimal = grab(Pc.decimal);
			let lowDigits = decimal ? 
				expect(digits(), 'Digits are always expected after a decimal point') 
				: digits();
			let exp = grab(Pc.signedExponent);
			let expDigits = exp ? 
				expect(digits(), 'A value is required for the exponent') 
				: digits();

			val = [uint, decimal, lowDigits, exp, expDigits].filter(e => e).join('');
			if(exp && !uint && !lowDigits) {
				val = val.replace(Pc.exponent, '1'+Pc.exponent);
			}
			let result = Number(val.replace(Pc.exponent, 'e'));
			if(isNaN(result)) {
				perr(c, `Not a valid number: {${val}}`);
			}
			return result;
		}
	}

	function comparison() {
		let lhs = arithmetic();
		if(lhs === null) { return null; }
		let op = grab(Pc.relationOps);
		if(!op) {return lhs;}
		let rhs = arithmetic();
		if (rhs === null) {
			perr(c, `Expression expected on the right side of a comparison. Found {${grab(Pc.anyToken)}}`);
		}
		return {op: op, lhs:lhs, rhs: rhs}
	}

	function booleanPrimary() {
		let not_op = grab(Pc.logicalNot);
		let val = grab(Pc.logicalVal);
		if(val) {
			val = Boolean(val);
		}
		else {
			val = comparison();
			if(typeof(val) == 'number') {
				return null;
			} 
			else if(val === null || typeof(val) == 'object' && 'op' in val && !val.op.match(Pc.relationOps)) {
				return null;
			}
		}
		if(not_op) {
			return {op: not_op, arg: val};
		}
		else {
			return val;
		}
	}

	function unsignedSimpleArithmetic() {
		return parseBinary(Pc.arithmeticOps, arithmetic, arithmeticPrimary);
	}

	function simpleArithmetic() {
		let start = c;
		let ops = Pc.arithmeticOps;
		let sign_op = grab(ops[0]);
		if(sign_op) {
			let lhs = {
				op: sign_op,
				arg: expect(parseBinary(ops, arithmetic, arithmeticPrimary, 1), "Expected an expression for the sign operator")
			};
			let next_op = grab(ops[0]);
			if(next_op) {
				return {
					op: next_op,
					lhs: lhs,
					rhs: expect(unsignedSimpleArithmetic(), "Expected the right-hand side of the expression")
				};
			}
			return lhs;
		}
		else {
			let exa = unsignedSimpleArithmetic();
			if(exa === null) { c = start; }
			return exa;
		}
	}

	function simpleBoolean() {
		let start = c;
		let exp = parseBinary(Pc.logicOps, boolean, booleanPrimary);
		if(!exp) { c = start; }
		return exp;
	}

	function ifElse(lhs = null, rhs = null) {
		let lif = ifClause();
		if(lif) {
			grabOrDie(Pc.cond_then);
			let then_do = expect(lhs(), `No condition after then-clause for conditional expression`);
			grabOrDie(Pc.cond_else, "{else} clause is mandatory for conditional expressions.");
			let else_do = expect(rhs(), `No expression found after {else}`);
			
			return {
				cond:lif, 
				then_do:then_do, 
				else_do:else_do
			};
		}
		else {
			return lhs();
		}
	}

	function simpleExpression() {
		let ex = simpleBoolean();
		if (!ex) {
			return simpleArithmetic();
		}
		return ex;
	}

	function expression() {
		return ifElse(simpleExpression, expression);
	}

	function arithmetic() {
		return ifElse(simpleArithmetic, arithmetic);
	}

	function boolean() {
		return ifElse(simpleBoolean, boolean);
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
		if(specifiers.length) {
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
			if(typeof(list[i]) != 'string') {
				perr(c, `Expression {${JSON.stringify(list[i])}} cannot be assigned to`);
			}
		}
		let value = list.pop();
		return {
			vars:list,
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
				perr(c, `Expected an argument to procedure {${name}}`);
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
					let [before, after] = getPositions(beforeLongComma, c);
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
		else if(typeof(exp) == 'string') {
			return {func: exp, args: []};
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
