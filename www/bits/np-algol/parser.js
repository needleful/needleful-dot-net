
function parseAlgol(text, options = {}) {
	const Pc = {
		begin: 'begin',
		end: 'end',
		comment: 'comment',
		own: 'own',
		types: ['real', 'integer', 'Boolean'],
		procedure: 'procedure',
		semicol: ';',
		cond_if: 'if',
		cond_then: 'then',
		cond_else: 'else',
		comma: ',',
		assign: ':=',
		parenOpen: '(',
		parenClose: ')',
		postComment: /^([^;]*);?/,
		identPart: /^\p{Alpha}[\p{Alpha}\d]*/u,
		ofType:/^(real|integer|Boolean)/,
		anyToken:/^\S+/,
		sign:/^(\+|-)/,
		decimal:'.',
		digits: /^\d+/,
		exponent:'_e',
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
		logicalNot: '!',
		relationOps:/^(<|<=|=|>=|>|!=)/,
		arithmeticOps:[
			// Arithmetic
			/^(\+|-)/,	
			/^(\*|\/|%)/,
			/^\^/
		],
	};
	// Forgive me
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
		return grab(Pc.identPart);
	}

	function stroppedIdentifier() {
		function checkWord(word) {
			if (keywords.includes(word)) {
				pwarn(c, `Variable name includes keyword: {${word}}. Is that correct?`);
				return true;
			}
			return false;
		}
		let word = grab(Pc.identPart);
		if(!word) {
			return null;
		}
		checkWord(word, options);
		let wordEnd = false;
		let wordParts = 1;
		while(good() && !wordEnd) {
			let w2 = grab(Pc.identPart);
			if(w2) {
				checkWord(w2);
				word += w2;
				wordParts += 1;
			}
			else {
				wordEnd = true;
			}
		}
		if(wordParts > 1) {
			pwarn(c, `Identifier contains whitespace. Reading as {${word}}`);;
		}
		return word;
	}

	function parseBinary(ops, top, primary, index = 0) {
		if(index >= ops.length) {
			return primary();
		}
		let op = ops[index];
		let lhs;
		if(grab(Pc.parenOpen)) {
			lhs = top();
			grabOrDie(Pc.parenClose, 'Expected a closing parenthesis for the nested expression');
		}
		else{
			lhs = parseBinary(ops, top, primary, index + 1);
		}
		if(!lhs) {
			return null;
		}

		let foundOp = grab(op);
		if(foundOp) {
			let rhs = expect(parseBinary(ops, top, primary, index + 1), `Missing the right-hand side of {${foundOp}}`);
			return {op: foundOp, left:lhs, right:rhs}
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
			return val;
		}
		else {
			let sign = grab(Pc.sign);
			let uint = digits();
			let decimal = grab(Pc.decimal);
			let lowDigits = decimal ? 
				expect(digits(), 'Digits are always expected after a decimal point') 
				: digits();
			let exp = grab(Pc.signedExponent);
			let expDigits = exp ? 
				expect(digits(), 'A value is required for the exponent') 
				: digits();

			val = [sign, uint, decimal, lowDigits, exp, expDigits].filter(e => e).join('');
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
		if(!lhs) { return null; }
		let op = grab(Pc.relationOps);
		if(!op) {return lhs;}
		let rhs = expect(arithmetic(), "Expression expected on the right side of a comparison.");
		return {op: op, lhs:lhs, rhs: rhs}
	}

	function booleanPrimary() {
		let not_op = grab(Pc.logical_not);
		let val = comparison();
		if(!val) {
			val = grab(Pc.logicalVal);
			val = val? Boolean(val) : identifier();
		}
		if(typeof(val) == 'number' || 
			typeof(val) == 'object' && 'op' in val && !val.op.match(Pc.relationOps)) 
		{
			perr(c, 'Expected a boolean expression, found arithmetic instead');
		}
		if(not_op) {
			return {op: not_op, arg: expect(val)};
		}
		else {
			return val;
		}
	}

	function simpleArithmetic() {
		return parseBinary(Pc.arithmeticOps, arithmetic, arithmeticPrimary);
	}

	function simpleBoolean() {
		return parseBinary(Pc.logicOps, boolean, booleanPrimary);
	}

	function ifElse(lhs, rhs) {
		let lif = ifClause();
		if(lif) {
			grabOrDie(Pc.cond_then);
			let then_do = expect(lhs(), `No condition after then-clause for conditional expression`);
			grabOrDie(Pc.cond_else, "{else} clause is mandatory for conditional expressions.");

			let else_do = expect(arithmetic(), `No expression found after {else}`);
			
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

	function arithmetic() {
		return ifElse(simpleArithmetic, arithmetic);
	}

	function boolean() {
		return ifElse(simpleBoolean, boolean);
	}

	function declaration(type, own = false) {
		let vars = [];
		let declEnd = false;
		while(good()) {
			let nextVar = identifier();
			if(!nextVar) {
				 if(grab(Pc.semicol)) {
					perr(c, `Declarations list can't be empty.`);
				}
				else if(grab(Pc.comma)) {
					perr(c, `Empty item (or extra comma) in declarations list`);
				}
				else {
					perr(c, `Expected an identifier, found {${grab(Pc.anyToken)}}`);
				}
			}
			vars.push(nextVar);

			if(grab(Pc.semicol)){
				break;
			}
			else {
				grabOrDie(Pc.comma);
			}
		}
		return {decl: type, own: own, vars:vars};
	}

	function assignment(firstVar) {
		let result = {vars:[firstVar]};
		while(good()) {
			if(grab(Pc.semicol) || peek(Pc.end)) {
				perr(c, `Assignment to {${firstVar}} without a value on the right-hand side`);
			}
			let next = arithmetic();
			if(typeof(next) == 'string') {
				if (grab(Pc.assign)) {
					result.vars.push(next);
					continue;
				}
				else if(grab(Pc.semicol) || peek(Pc.end)) {
					result.value = next;
					break;
				}
				else {
					perr(c, `Unexpected text in assignment {${result.vars} := ${next}}: {${grab(Pc.anyToken)}}`);
				}
			}
			else if(next) {
				result.value = next;
				if(grab(Pc.semicol) || peek(Pc.end)) {
					break;
				}
				else if(grab(Pc.assign)) {
					perr(c, `Cannot assign more variables after expression {${next}}`);
				}
				else {
					perr(c, `Unexpected tokens after assignment {${result.vars} := ${next}}: {${grab(Pc.anyToken)}}. Missing semicolon?`)
				}
			}
			else {
				perr(c, 'Invalid arithmetic expression in assignment');
			}
		}
		return result;
	}

	function blockHead() {
		let declarations = [];
		while(good()) {
			if(peek(Pc.begin) || peek(Pc.end)) {
				break;
			}
			let word = grab(/^\p{Alpha}+/u);
			if(word == Pc.own) {
				let next = expect(grab(Pc.ofType), 
					`Expected one of [${Pc.types}] after {own}. Found {${next}}`)
				declarations.push(declaration(next, true));
			}
			else if(word == Pc.comment) {
				grab(Pc.postComment);
			}
			else if(Pc.types.includes(word)) {
				declarations.push(declaration(word));
			}
			else if(word) {
				// Let the block tail figure it out
				backtrack(word);
				break;
			}
			else if(grab(Pc.semicol)) {
				continue;
			}
		}
		return declarations;
	}

	function blockTail() {
		let block = [];
		let ended = false;
		while(good()) {
			let word = grab(Pc.identPart);
			if(word == Pc.own) {
				perr(c, "Cannot declare new variables after the block head");
			}
			else if(word == Pc.begin) {
				let head = blockHead();
				let tail = blockTail();
				block.push({head:head, tail:tail});
			}
			else if(word == Pc.end) {
				let comment = grab(Pc.postComment);
				if(!comment) {
					pwarn(c, `Expected a semicolon after 'end'.`);
				}
				else if(comment.indexOf('\n') >= 0 && comment.indexOf('end') >= 0) {
					pwarn(c, `Comment after 'end' extends more than one line. Is that intentional?`);
				}
				ended = true;
				break;
			}
			else if(word) {
				if(grab(Pc.assign)) {
					block.push(assignment(word));
				}
			}
			else if(grab(Pc.semicol)){
				// Dummy statement
				continue;
			}
			else {
				pwarn(c, "Unexpected text: ", grab(Pc.anyToken));
			}
		}
		expect(ended, 'Document ended with more `begin` than `end` brackets.');
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
			perr(c, `Expected token {${query}} found {${grab(Pc.anyToken)}}, ${error? error : ""}`);
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
		let end = text.substr(c-token.length, token.length);
		if(end != token) {
			perr(c, `PARSER BUG: Tried to backtrack on token {${token}}, but the value was {${end}}` );
		}
		c -= token.length;
	}

	grabOrDie(Pc.begin, "Keyword {begin} is required at the start of a program.");
	let head = blockHead();
	let tail = blockTail();
	return {head: head, tail: tail};
}
