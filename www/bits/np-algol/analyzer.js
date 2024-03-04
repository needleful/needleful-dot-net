"use strict";
function defaultEnv() {
	const binOp = (type, inline) => ({type: type,  params: [type, type], inline: inline});
	const cmpOp = (type, inline) => ({type: T.i32, params: [type, type], inline: inline});
	const unOp  = (type, inline) => ({type: type,  params: [type],       inline: inline});
	return {
		// Simple integer ops
		'i+i':  binOp(T.i64, I.i64add),
		'i-i':  binOp(T.i64, I.i64sub),
		'i*i':  binOp(T.i64, I.i64mul),
		'i%i':  binOp(T.i64, I.i64div_s),
		'-i':   unOp(T.i64, [I.i64, leb_const(-1), I.i64mul]),

		// Simple real ops
		'r+r':binOp(T.f64, I.f64add),
		'r-r':binOp(T.f64, I.f64sub),
		'r*r':binOp(T.f64, I.f64mul),
		'r/r':binOp(T.f64, I.f64div),
		'-r': unOp(T.f64, I.f64neg),

		// Comparison ops
		'i<i':  cmpOp(T.i64, I.i64lt_s),
		'i>i':  cmpOp(T.i64, I.i64gt_s),
		'i<=i': cmpOp(T.i64, I.i64le_s),
		'i>=i': cmpOp(T.i64, I.i64ge_s),
		'i=i':  cmpOp(T.i64, I.i64eq),
		'i!=i': cmpOp(T.i64, I.i64ne),

		'r<r':  cmpOp(T.f64, I.f64lt),
		'r>r':  cmpOp(T.f64, I.f64gt),
		'r<=r': cmpOp(T.f64, I.f64le),
		'r>=r': cmpOp(T.f64, I.f64ge),
		'r=r':  cmpOp(T.f64, I.f64eq),
		'r!=r': cmpOp(T.f64, I.f64ne),

		// Boolean ops
		'#and#': binOp(T.i32, I.i32and),
		'#or#':  binOp(T.i32, I.i32or),
		'#is#':  binOp(T.i32, I.i32eq),
		'#not#': unOp(T.i32, I.i32eqz),
		'#implies#': {type: T.i32, params:[T.i32, T.i32], param_names:['a', 'b'], 
			code: [IR.ret, op2(call('#not#', ['a']), '#or#', 'b')]},

		// Exponentiation
		'i^i': {
			type: T.i64, params: [T.i64, T.i64], param_names:['x', 'e'], locals:[[T.i64, 'RES', 'i'], [T.i64, 'z']],
			code: block([
				if_else(
					op2(op2('e', 'i<=i', integer(0)), 
						'#or#', 
						op2(op2('x', 'i=i', integer(0)), 
							'#and#', 
							op2('e', 'i=i', integer(0)))
					),
					//call('fault', [string_lit("Undefined exponent"), 'e']),
					[IR.ret, integer(-1)],
					assign('RES', integer(1)),
					loop_while(op2('e', 'i>i', integer(0)),
						block([
							assign('i', call('ctz', 'e')),
							assign('e', 
								op2('e', 'i&i', 
									op1('!i', op2(integer(1), 'i<<i', 'i')))),
							assign('z', 'x'),
							loop_while(op2('i', 'i>i', integer(0)),
								block([
									assign('z', op2('z', 'i*i', 'z')),
									assign('i', op2('i', 'i-i', integer(1)))
								])),
							assign('RES', op2('RES', 'i*i', 'z')),
						])),
				),
				[IR.ret, 'RES'],
			])
		},

		'r^i':{type:T.f64, params: [T.f64, T.i64], param_names:['x', 'e'], locals:[[T.i64, 'a', 'i'], [T.f64, 'RES', 'z']],
			code: block([
				if_else(
					op2(op2('x', 'r=r', real(0)), 
						'#and#', 
						op2('e', 'i<=i', integer(0))),
					//call('fault', [string_lit("Undefined exponent"), 'e']),
					[IR.ret, real(NaN)],
					block([
						assign('a', call('iabs', ['e'])),
						assign('RES', real(1)),
						loop_while(op2('a', 'i>i', integer(0)),
							block([
								assign('i', call('ctz', 'e')),
								assign('a', 
									op2('a', 'i&i', 
										op1('!i', op2(integer(1), 'i<<i', 'i')))),
								assign('z', 'x'),
								loop_while(op2('i', 'i>i', integer(0)),
									block([
										assign('z', op2('z', 'r*r', 'z')),
										assign('i', op2('i', 'i-i', integer(1)))
									])),
								assign('RES', op2('RES', 'r*r', 'z'))
							])),
						if_then(op2('e', 'i<i', integer(0)),
							assign('RES', op2(real(1), 'r/r', 'RES')))
					]),
				),
				[IR.ret, 'RES']
			])
		},

		// Expected math functions
		abs: {
			params: [T.f64], type: T.f64, param_names:['r'],
			code: [IR.ret, if_else( op2('r', 'r<r', real(0)),
				call('-r', 'r'),
				'r'
			)]
		},

		iabs: {
			params:[T.i64], type: T.i64, param_names:['a'], 
			code:[IR.ret, if_else( op2('a', 'i<i', integer(0)),
					op2(integer(0), 'i-i', 'a'),
					'a'
				)]
		},

		entier: {params: [T.f64], type: T.i64, inline: I.i64truncf64_s},

		'outinteger': {type: T.block, params: [T.i64, T.i64], import: 'io'},
		'outreal':    {type: T.block, params: [T.i64, T.f64], import: 'io'},
		'outboolean': {type: T.block, params: [T.i64, T.i32], import: 'io'},

		// Extended functions
		'i<<i': binOp(T.i64, I.i64shl),
		'i>>i': binOp(T.i64, I.i64shr_u),
		'i&i':  binOp(T.i64, I.i64and),
		'i|i':  binOp(T.i64, I.i64or),
		'i><i': binOp(T.i64, I.i64xor),
		'!i':   unOp(T.i64, [I.i64, leb_const(-1), I.i64xor]),

		'shiftr': binOp(T.i64, I.i64shr_s),
		'ctz':    unOp(T.i64, I.i64ctz),
		'toreal': { type: T.f64, params: [T.i64], inline: I.f64converti64_s },
		'round':  { type: T.i64, params: [T.f64], inline: [
			I.f64, f64_const(0.5), I.f64add, I.i64truncf64_s
		]},
	};
}

const algolTypes = {
	integer: T.i64,
	real: T.f64,
	Boolean:T.i32,
	void: T.block,
};

const algolTypeNames = {
	[T.i64]: 'integer',
	[T.f64]: 'real',
	[T.i32]: 'Boolean',
	[T.block]: 'void',
}

function analyze(text, root_ast) {
	let ir_module = defaultEnv();

	function expError(exp, message) {
		if(exp.context) {
			let [pos] = getPositions(text, exp.context);
			console.log('Error at: ', pos);
			throw new Error(`Analysis failed at ${pos.line}:${pos.column}: ${message}`);
		}
		throw new Error(message);
	}

	function resolveProc(proc_name, context, required){
		if(proc_name in context.procs) {
			return context.procs[proc_name];
		}
		else if(context.parent) {
			return resolveProc(proc_name, context.parent);
		}
		else if(!required) {
			return null;
		}
		else {
			throw new Error(
				`Referenced procedure {${proc_name}}, which is not defined in this or any parent scope.`);
		}
	}

	function resolveVar(var_name, context, required){
		if(var_name in context.vars) {
			return context.vars[var_name];
		}
		else if(context.parent) {
			let r = resolveVar(var_name, context.parent, required);

			if(context.procedure) {
				console.warn(`Retrieving {${var_name}} from outside the scope of procedure ${context.name}. This is not currently supported.`);
			}
			return r;
		}
		else if(!required) {
			return null;
		}
		else {
			throw new Error(`Variable {${var_name}} was not found.`);
		}
	}

	function analyzeBlock(ast, context) {
		// We get all the procedure definitions
		let locals = {};
		for(let v in context.vars) {
			let loc = context.vars[v];
			if(!(loc.type in locals)) {
				locals[loc.type] = [];
			}
			locals[loc.type].push[v];
		}
		for(let d in ast.head) {
			let decl = ast.head[d];
			if('proc' in decl) {
				if(decl.proc in context.procs) {
					throw new Error(`Local procedure already defined: {${decl.proc}}`);
				}
				let proc = analyzeDefinition(decl, context);
				context.procs[decl.proc] = proc;
				ir_module[proc.fqname] = proc;
			}
			else if('decl' in decl) {
				let type = decl.decl;
				if(!(type in locals)) {
					locals[type] = [];
				}
				locals[type] = locals[type].concat(decl.vars);
				let real_type = algolTypes[type];
				if(!real_type) {
					expError(decl, 'Bad type: '+type);
				}
				for(let v of decl.vars) {
					if(v in context.vars) {
						throw new Error(`Local variable already defined: {${v}}`);
					}
					let fqVar = v;
					if(!context.procedure) {
						fqVar += context.path;
					}
					context.vars[v] = {type: real_type, fqname:fqVar};
				}
			}
			else {
				throw new Error(`PARSER BUG: unknown AST declaration: ${JSON.stringify(decl)}`);
			}
		}

		// Analyze the function bodies
		for(let p in context.procs) {
			let proc = context.procs[p];
			if('code' in proc || 'inline' in proc || 'import' in proc) {
				continue;
			}
			let params = {};
			if(proc.param_names) {
				for(let p2 = 0; p2 < proc.param_names.length; p2++) {
					let param = proc.param_names[p2];
					params[param] = {
						type: proc.params[p2]
					}
					if(!params[param].type) {
						throw new Error(`ANALYZER BUG: no type defined for parameter {${param}} in procedure {${proc.fqname}}`)
					}
				}
			}
			if(!proc.fqname) {
				throw new Error(`No fully qualified name for procedure: ${p}`);
			}
			let procContext = {
				name: p,
				path: '@' + proc.fqname,
				procs: {},
				vars: params,
				parent: context,
				delimiters: proc.delimiters,
				procedure: true,
				childCount: 0,
			};
			let result = analyzeBody(proc, procContext);
			proc.code = result.code;
			if(!proc.code) {
				expError(ast, `ANALYSIS BUG: Procedure ${p} has an invalid body: {${proc.code}}`);
			}
			proc.locals = result.locals;
			proc.body_ast = null;
		}
		let statements = [];
		for(let statement of ast.tail) {
			statements.push(analyzeStatement(statement, context));
		}
		return {locals: locals, code:[IR.block].concat(statements)};
	}
	function analyzeDefinition(decl, context) {
		let params = {};
		for (let p of decl.parameters) {
			params[p] = {};
		}
		if(decl.specifiers) {
			for (let spec of decl.specifiers) {
				if('type' in spec) {
					for (let v of spec.values) {
						if(!(v in params)) {
							throw new Error(
								`While defining ${decl.proc}: Specifying non-existent parameter {${v}} is of type {${spec.type}}`);
						}
						if('type' in params[v]) {
							throw new Error(`While defining ${decl.proc}: Parameter {${v}} already declared of type ${params[v].type}, now re-declared of type ${spec.type}`);
						}
						params[v].type = spec.type;
					}
				}
			}
		}
		if(decl.values) {
			for(let val of decl.values) {
				if(!(val in params)) {
					throw new Error(`While defining ${decl.proc}: Specified unknown parameter {${val}} as a value.`);
				}
				params[val].value = true;
			}
		}
		for(let p in params) {
			if(!params[p].type) {
				console.log(`While defining ${decl.proc}: type of parameter {${p}} was not defined. Defaulting to real`);
				params[p].type = 'real';
			}
			if(!params[p].value) {
				console.log(`TODO: While defining ${decl.proc}: parameter {${p}} was not declared as a value. Call-by-name is not currently implemented`);
			}
		}

		return {
			fqname: decl.proc+context.path,
			type: algolTypes[decl.type],
			param_names: decl.parameters,
			params: decl.parameters.map(p => algolTypes[params[p].type]),
			exported: context.path == '',
			body_ast: decl.body
		};
	}
	function analyzeBody(proc, context) {
		let ast = proc.body_ast;
		if(!ast) {
			throw new Error(`ANALYSIS BUG: No AST when analyzing ${context.path}`)
		}
		if(proc.type != T.block) {
			context.vars[context.name] = {
				type: proc.type,
				return: true
			};
		}
		let code;
		if('head' in ast) {
			code = analyzeBlock(ast, context).code;
		}
		else {
			code = analyzeStatement(ast, context);
		}
		if(!code) {
			expError(ast, `Body of procedure ${context.name} is {${code}}!`);
		}
		if(proc.type != T.block) {
			code = [IR.block, code, [IR.ret, context.name]];
		}
		let localsByType = {};
		for(let loc in context.vars) {
			if(proc.param_names && proc.param_names.includes(loc)) {
				continue;
			}
			let local = context.vars[loc];
			if(!(local.type in localsByType)) {
				localsByType[local.type] = [loc];
			}
			else {
				localsByType[local.type].push(loc);
			}
		}
		let localsArray = [];
		for(let notTheTypeThisIsAStringEvenWhenTheKeyIsAnInt in localsByType) {
			let type = Number(notTheTypeThisIsAStringEvenWhenTheKeyIsAnInt);
			let result = [type].concat(localsByType[type]);
			localsArray.push(result);
		}
		return {locals:localsArray, code:code};
	}
	function analyzeStatement(st, context) {
		if('assign' in st){
			function checkedAssign(v, value) {
				let lv = resolveVar(v, context, true);
				return [IR.assign, lv.fqname, typeConvert(value.code, val.type, lv.type)];
			}
			let val = analyzeExpression(st.assign, context);
			if(st.vars.length == 1) {
				return checkedAssign(st.vars[0], val);
			}
			let block = [IR.block];
			// Assign to each, one at a time
			for(v in st.vars) {
				block.push(checkedAssign(v, val));
				val = resolveVar(v, context, true);
				val.code = v;
			}
			return block;
		}
		else if('func' in st) {
			return checkedCall(st, context).code;
		}
		else if ('head' in st) {
			let subContext = {
				parent:context,
				type: T.block,
				vars: {},
				procs: {},
				procedure: false,
				childCount: 0,
			};
			subContext.name = 'block'+(++context.childCount);
			subContext.path = '@'+subContext.name + context.path;
			let subBlock = analyzeBlock(st, subContext);
			for(let l in subContext.vars) {
				let local = subContext.vars[l];
				context.vars[local.fqname] = local;
			}
			return subBlock.code;
		}
		else {
			expError(st, "Could not analyze statement: "+JSON.stringify(st));
		}
	}

	function typeConvert(code, fromType, toType) {
		if(fromType == toType) {
			return code;
		}
		if(fromType == T.i64 && toType == T.f64) {
			if(code[0] == IR.iconst) {
				return [IR.rconst, code[1]];
			}
			return call('toreal', [code]);
		}
		else if(fromType == T.f64 && toType == T.i64) {
			if(code[0] == IR.rconst) {
				return [IR.iconst, code[1]];
			}
			console.log(`Warning: rounding real expression {${ir_almost_pretty_print(code)}} to integer`);
			return call('round', [code]);
		}
		else {
			throw new Error(
				`Cannot convert from type ${algolTypeNames[fromType]} to ${algolTypeNames[toType]} in expression {${ir_almost_pretty_print(code)}}`)
		}
	}

	function checkedCall(exp, context) {
		let sym = resolveProc(exp.func, context);
		if(sym) {
			if(!sym.fqname) {
				// Presumably this is correct
				sym.fqname = exp.func;
			}
			let args = [];
			for(let a of exp.args) {
				let a2 = analyzeExpression(a, context);
				let index = args.length;
				if(index >= sym.params.length) {
					expError(a, `Extra parameters to procedure ${exp.func}`);
				}
				args.push(typeConvert(a2.code, a2.type, sym.params[index]));
			}
			if(args.length < sym.params.length) {
				expError(exp, `Procedure {${exp.func}} expected ${sym.params.length} arguments, but was called with only ${args.length}`);
			}
			return {type: sym.type, code:call(sym.fqname, args)};
		}
		else {
			let pos = getPositions(text, exp.context);
			expError(exp, `{${exp.func}} is not a defined procedure in this scope`);
		}
	}

	function analyzeExpression(exp, context) {
		if(context === undefined) {
			throw new Error("Undefined context");
		}
		if('value' in exp){
			if(exp.type == 'numeric') {
				if(exp.value | 0 == exp.value) {
					return {type: T.i64, code: integer(exp.value)};
				}
				else {
					return {type: T.f64, code: real(exp.value)};
				}
			}
			else if(exp.type == 'Boolean') {
				return{type: T.i32, code: int32(exp.value)};
			}
		}
		else if('func' in exp) {
			return checkedCall(exp, context);
		}
		else if ('variable' in exp) {
			let sym = resolveVar(exp.variable, context);
			if(sym) {
				if(!sym.type) {
					expError(exp, `Variable ${exp.variable} has no defined type`);
				}
				return {type: sym.type, code:sym.fqname};
			}
			sym = resolveProc(exp.variable, context);
			if(sym) {
				return {type: sym.type, code:call(sym.fqname, [])};
			}
			else {
				expError(exp, `{${sym}} is not a variable or procedure available in this block.`)
			}
		}
		else if('op' in exp) {
			function isStringOp(op) {
				return op.match(/\p{Alpha}/u);
			}
			function findStringOp(op) {
				let fqOp = "#"+op+"#";
				let opProc = resolveProc(fqOp, context);
				return [opProc, fqOp];
			}
			function typeChar(type) {
				return algolTypeNames[type][0];
			}

			function findBinOp(op, leftType, rightType) {
				let opProc, fqOp;
				if(isStringOp(op)) {
					[opProc, fqOp] = findStringOp(op);
				}
				else {
					fqOp = typeChar(leftType) + op +  typeChar(rightType);
					opProc = resolveProc(fqOp, context);
				}

				if (!opProc || opProc.params[0] != leftType || opProc.params[1] != rightType) {
					if(rightType == T.i64) {
						return findBinOp(op, leftType, T.f64);
					}
					else if(leftType == T.i64) {
						return findBinOp(op, T.f64, rightType);
					}
					throw new Error(
						`Operator {${op}} is not defined between types ${algolTypeNames[leftType]} and ${algolTypeNames[rightType]}`)
				}
				return [opProc, fqOp];
			}
			function findSingleOp(op, argType) {
				let opProc, fqOp;
				if(isStringOp(op)) {
					[opProc, fqOp] = findStringOp(op);
				}
				else {
					fqOp = op + typeChar(argType);
					opProc = resolveProc(fqOp, context);
				}
				if(!opProc || opProc.params[0] != argType) {
					if(argType == T.i64) {
						return findSingleOp(op, T.f64);
					}
					throw new Error(
						`Unary operator {${op}} is not defined for ${algolTypeNames[argType]} values`);
				}
				return [opProc, fqOp];
			}

			let right = analyzeExpression(exp.right, context);
			if('left' in exp) {
				let left = analyzeExpression(exp.left, context);

				let [opProc, fqOp] = findBinOp(exp.op, left.type, right.type);
				return {
					type: opProc.type, 
					code:op2(
						typeConvert(left.code, left.type, opProc.params[0]), 
						fqOp, 
						typeConvert(right.code, right.type, opProc.params[1]))
				};
			}
			else {
				let [opProc, fqOp] = findSingleOp(exp.op, right.type);
				return {
					type: opProc.type,
					code: call(fqOp, typeConvert(right.code, right.type, opProc.params[0]))
				};
			}
		}
		else if('cond' in exp) {
			let cond = analyzeExpression(exp.cond, context);
			let then_do = analyzeExpression(exp.then_do, context);
			if('else_do' in exp) {
				let else_do = analyzeExpression(exp.else_do, context);
				if(else_do.type != then_do.type) {
					else_do.code = typeConvert(else_do.code, else_do.type, then_do.type);
				}
				return {type: then_do.type, code: if_else(cond.code, then_do.code, else_do.code)};
			}
			else {
				return {type: T.block, code: if_then(cond.code, then_do.code)};
			}

		}
		expError(exp, `Could not analyze expression: ${JSON.stringify(exp)}`);
	}

	let rootContext = {
		name:"#main#",
		path:"",
		parent: null,
		procs: ir_module,
		vars: {},
		procedure: true,
		childCount: 0,
	};

	let main_proc = {
		fqname: rootContext.name,
		exported: true,
		params: [],
		type: T.block,
		body_ast: root_ast
	};

	let main = analyzeBody(main_proc, rootContext);
	main_proc.code = main.code;
	main_proc.locals = main.locals;
	if(!main_proc.code) {
		throw new Error("COMPILER BUG: Main procedure has no code! " + main_proc.code);
	}
	ir_module[main_proc.fqname] = main_proc;
	main_proc.body_ast = null;
	return ir_module;
}
