
// Expression types
let IR = {
	iconst: 	1,
	rconst: 	2,
	ret:    	3,
	assign: 	4,
	if_else: 	5,
	block:  	6,
	call:   	7,
	loop_while: 8,
	if_then: 	9,
	inline: 	10
}
IR.min_args = {
	[IR.iconst]:1,
	[IR.rconst]:1,
	[IR.assign]:2,
	[IR.if_else]:3,
	[IR.ret]:1,
	[IR.call]:1,
	[IR.loop_while]:2,
	[IR.declare]:2,
	[IR.if_then]:2,
	[IR.block]:0,
};
IR.max_args = {
	[IR.iconst]:1,
	[IR.rconst]:1,
	[IR.assign]:2,
	[IR.if_else]:3,
	[IR.ret]:1,
	[IR.call]:Infinity,
	[IR.loop_while]:2,
	[IR.declare]:2,
	[IR.if_then]:2,
	[IR.block]:Infinity,
};
Object.freeze(IR);

const type_map = {
	integer: T.i64,
	real: T.f64,
	Boolean:T.i32,
	void: T.block,
};

const inv_type_map = {
	[[T.i64]]: 'integer',
	[[T.f64]]: 'real',
	[[T.block]]: 'void',
	[[T.i32]]: 'Boolean'
}

function op1(opcode, value) {
	return [IR.call, opcode, value];
}

function op2(left, opcode, right) {
	return [IR.call, opcode, left, right];
}

function call(name, args) {
	return [IR.call, name].concat(args);
}

function integer(value) {
	return [IR.iconst, value];
}

function real(value) {
	return [IR.rconst, value];
}

function declare(type, name) {
	return [IR.declare, type, name];
}

function assign(name, value) {
	return [IR.assign, name, value];
}

function if_else(condition, iftrue, iffalse) {
	return [IR.if_else, condition, iftrue, iffalse];
}

function if_then(condition, statement) {
	return [IR.if_then, condition, statement];
}

function loop_while(condition, body) {
	return [IR.loop_while, condition, body];
}

function block(statements) {
	return [IR.block].concat(statements);
}

function almost_pretty_print(statement, i) {
	if(typeof(statement) == 'number' && i == 0) {
		return Object.keys(IR)[statement - 1];
	}
	else if(Array.isArray(statement)) {
		return statement.map(almost_pretty_print);
	}
	else {
		return statement;
	}
}

// Compile the IR to the lower-level intermediate syntax
const ir_to_assembler = (ir_mod) => {
	const eq = (a, b) => {
		if(!Array.isArray(a) || !Array.isArray(b)) {
			return a === b;
		}
		return a.length === b.length && a.every((e, i) => eq(e, b[i]));
	};
	const find_or_push = (array, value) => {
		let index = array.findIndex(e => eq(e, value));
		if (index < 0) {
			index = array.length;
			array.push(value)
		}
		return index;
	};
	let types = [];
	let funcs = [];
	let exported = [];
	let code = [];

	for (p in ir_mod) {
		let proc = ir_mod[p];
		if ("inline" in proc) {
			if (proc.exported) {
				console.log("COMPILER BUG: inline procedure "+ p +" is marked as exported, but inline procedures are never exported.");
			}
			if("code" in proc) {
				console.log("COMPILER BUG: inline procedure "+ p +" also has a 'code' property. Only one is expected.");
			}
			continue;
		}
		if(!proc.code && !proc.inlined) {
			console.log(proc);
			throw new Error("COMPILER BUG: Declared procedure "+p+" has no implementation!");
		}
		let ptype = find_or_push(types, [proc.params || [], proc.type]);
		if(ptype == undefined) {
			console.log(t);
			console.log(types);
			throw new Error("Failed to create type: ", t);
		}
		funcs.push(ptype);
		proc.index = funcs.length - 1;
		if (proc.exported) {
			exported.push([p, E.func, proc.index]);
		}
	}
	code.length = funcs.length;
	const compile_statement = (s, m, p, locals) => {
		try {
			const get_local = (id) => {
				if(id in locals) {
					return locals[id];
				}
				else {
					throw new Error("Unknown local var using id `"+id+"` of type "+typeof(id));
				}
			}
			if(s in locals) {
				let v = locals[s];
				return {type:v[1], code:[I.lget, leb_const(v[0])]};
			}
			else if(!Array.isArray(s) || s.length == 0) {
				console.log("malformed code: ", s);
				throw new Error("Malformed expression of type "+typeof(s));
			}

			let f = s[0];
			let argc = s.length - 1;
			if(!(f in IR.min_args)) {
				console.log(s);
				throw new Error("Unrecognized IR instruction: " + f)
			}
			if(IR.min_args[f] > argc) {
				console.log(s);
				throw new Error("Arguments to function "+s+" are less than minimum argunents: "+IR.min_args[f]);
			}
			if(IR.max_args[f] < argc) {
				console.log(s);
				throw new Error("Arguments to function "+s+" exceed maximum allowed arguments: ",IR.max_args[f]);
			}

			switch(f) {
			case IR.iconst: {
				return {type: T.i64, code:[I.i64, leb_const(s[1])]};
			} break;
			case IR.rconst: {
				return {type: T.f64, code:[I.f64, f64_const(s[1])]};
			} break;
			case IR.assign: {
				let v = get_local(s[1]);
				let c = compile_statement(s[2], m, p, locals);
				if (v[1] != c.type){
					throw new Error("Mismatched type between variable "+s[1]
						+" of type "+inv_type_map[v[1]]+" and expression "+s[2]+" of type "+inv_type_map[c.type]);
				}
				return {type: T.block, code:[c.code, I.lset, leb_const(v[0])]};
			} break;
			case IR.if_else: {
				let condition = compile_statement(s[1], m, p, locals);
				if(condition.type != T.i32) {
					console.log(s);
					console.log(condition);
					throw new Error('Conditions should be of type i32, not provided type: '+ condition.type);
				}
				let iftrue = compile_statement(s[2], m, p, locals);
				let iffalse = compile_statement(s[3], m, p, locals);
				if (iftrue.type != iffalse.type) {
					console.log(iftrue);
					console.log(iffalse);
					throw new Error("Mismatched types between if and else clauses");
				}
				return {
					type: iftrue.type,
					code: [
						condition.code,
						I.if, iftrue.type,
						iftrue.code,
						I.else,
						iffalse.code,
						I.end
					]
				}
			} break;
			case IR.ret: {
				let exp = compile_statement(s[1], m, p, locals);
				if (exp.type != p.type) {
					console.log(s[1]);
					console.log(p);
					throw new error("Return type does not match procedure type: "+exp.type+" versus "+p.type);
				}
				return {
					type: T.block, 
					code: exp.code.concat(I.return)
				};
			} break;
			case IR.call: {
				if(!(s[1] in m)) {
					console.log(s);
					throw new Error(`Undefined procedure: {${s[1]}}`);
				}
				let proc = m[s[1]];
				if(proc.params.length != s.length - 2) {
					console.log(s);
					throw new Error("procedure "+ [s[1]] + " expected "+proc.params.length+" arguments, recieved ",  s.length - 2);
				}
				let code = [];
				for(let i = 2; i < s.length; i++) {
					let arg = compile_statement(s[i], m, p, locals);
					if(arg.type != proc.params[i-2]){
						console.log(s[i]);
						console.log(arg);
						throw new Error("Mismatched type for arg "+(i-2)+" for procedure "+s[1]+": "
							+inv_type_map[proc.params[i-2]]+" expected, "+inv_type_map[arg.type]+" received.");
					}
					code = code.concat(arg.code);
				}
				if("inline" in proc) {
					code = code.concat(proc.inline);
				}
				else {
					code = code.concat([I.call, leb_const(proc.index)]);
				}
				return {
					type: proc.type,
					code: code 
				};
			} break;
			case IR.loop_while: {
				let condition = compile_statement(s[1], m, p, locals);
				if(condition.type != T.i32) {
					console.log(s[1]);
					console.log(s);
					throw new Error("Condition expression expected to be an i32, it was actually of type "+ condition.type);
				}
				let body = compile_statement(s[2], m, p, locals);
				if(body.type != T.block) {
					console.log(s[2]);
					console.log(s);
					throw new Error("Loop body expected to be a block type, it was actually of type "+ block.type);
				}
				return {
					type: T.block, 
					code:[ 
						I.block, T.block, I.loop, T.block,
							condition.code, I.i32eqz, I.br_if, 1,
							body.code,
							I.br, 0,
						I.end, I.end
					]
				};
			} break;
			case IR.if_then: {
				let condition = compile_statement(s[1], m, p, locals);
				if(condition.type != T.i32) {
					console.log(s[1]);
					console.log(s);
					throw new Error("Conditional expression expected to be an i32, it was actually of type "+ condition.type);
				}
				let body = compile_statement(s[2], m, p, locals);
				if(body.type != T.block) {
					console.log(s[2]);
					console.log(s);
					throw new Error("If-then body expected to be a block type, it was actually of type "+ block.type);
				}
				return {
					type: T.block,
					code: [
						I.block, T.block, condition.code, I.i32eqz, T.br_if, 0,
							body.code,
						I.end
					]
				};
			} break;
			case IR.block: {
				let code = [];
				for (let i = 1; i < s.length; i++) {
					let c = compile_statement(s[i], m, p, locals)
					if(c.type != T.block){
						console.log(s[i]);
						console.log(s);
						throw new Error("Expected statements in a block to be of void type, it was actually of type "+c.type);
					}
					code = code.concat(c.code);
				}
				return {type: T.block, code:code};
			} break;
			default:
				throw new Error("Unhandled IR instruction: "+f);
				break;
			}
		}
		catch(error) {
			console.log("Failed in statement: ", almost_pretty_print(s, 0));
			throw error;
		}
	};
	// We gathered all the names. Now time to compile the code
	for(p in ir_mod) {
		let proc = ir_mod[p];
		if("inline" in proc) {
			continue;
		}
		let var_map = {};
		if(proc.param_names) {
			proc.param_names.forEach((e, i) => {
				if(e in var_map) {
					throw new Error("Duplicate local variable: "+e);
				}
				var_map[e] = [i, proc.params[i]];
				var_map[i] = var_map[e];
			});
		}
		let locals = [];
		if(proc.locals) {
			let locals_start = proc.params.length;
			for(let p in proc.locals) {
				let list = proc.locals[p];
				let type = list.shift();
				locals.push([type, list.length]);
				list.forEach((name, i) => {
					let local_index = 1+locals_start;
					var_map[name] = [local_index, type];
					var_map[local_index] = var_map[name];
				});
			}
		}
		try {
			let compiled = compile_statement(proc.code, ir_mod, proc, var_map);
			code[proc.index] = [locals, compiled.code];
		}
		catch(error) {
			console.log('IR failed while compiling code for', p);
			throw error;
		}
	}
	return [
		[M.types].concat(types),
		[M.funcs].concat(funcs),
		[M.exports].concat(exported),
		[M.code].concat(code)
	];
}