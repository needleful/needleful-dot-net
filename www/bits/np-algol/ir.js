"use strict";
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
	inline: 	10,
	i32const: 	11,
}
IR.min_args = {
	[IR.iconst]:1,
	[IR.i32const]:1,
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
	[IR.i32const]:1,
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

function int32(value) {
	return [IR.i32const, value];
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

function ir_almost_pretty_print(statement, i) {
	if(typeof(statement) == 'number' && i == 0) {
		return Object.keys(IR)[statement - 1];
	}
	else if(Array.isArray(statement)) {
		return statement.map(ir_almost_pretty_print);
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
	let procedures = ir_mod.procedures;
	let types = [];
	let funcs = [];
	let imported = [];
	let exported = [];
	let code = [];
	let globals = [];
	let globals_map = {};
	const zeroCode = {
		[T.f64]: [I.f64, f64_const(0)],
		[T.i64]: [I.i64, leb_const(0)],
		[T.i32]: [I.i32, leb_const(0)]
	};
	ir_mod.globals.forEach((g, i) => {
		let [type, name] = g;
		globals_map[name] = {index:i, type:type};
		globals_map[i] = globals_map[name];
		globals.push([type, G.variable, zeroCode[type], I.end]);
	});
	for (let p in procedures) {
		let proc = procedures[p];
		if ("inline" in proc) {
			if (proc.exported) {
				console.log("COMPILER BUG: inline procedure "+ p +" is marked as exported, but inline procedures are never exported.");
			}
			if("code" in proc) {
				console.log("COMPILER BUG: inline procedure "+ p +" also has a 'code' property. Only one is expected.");
			}
			if('import' in proc) {
				console.log("COMPILER BUG: inline procedure "+ p +" also has an import specified. Only one is expected.");
			}
			continue;
		}
		if(!proc.code && !proc.inlined && !proc.import) {
			console.log(proc);
			throw new Error("COMPILER BUG: Declared procedure "+p+" has no implementation!");
		}
		// I used T.block for functions without return types, but in WASM it uses an empty vector
		let realReturnType = proc.type != T.block? proc.type : [];
		let ptype = find_or_push(types, [proc.params || [], realReturnType]);
		if(ptype == undefined) {
			console.log(t);
			console.log(types);
			throw new Error("Failed to create type: ", t);
		}
		if('import' in proc) {
			if("code" in proc) {
				console.log("COMPILER BUG: imported procedure "+ p +" also has a 'code' property. Only one is expected.");
			}
			else if(proc.exported) {
				console.log("COMPILER BUG: imported procedure "+ p +" is marked as exported. This is invalid.");
			}
			proc.index = imported.length;
			imported.push([proc.import, p, E.func, ptype]);
		}
		else {
			proc.index = funcs.length;
			funcs.push(ptype);
		}
	}
	code.length = funcs.length;
	const compile_statement_s = (s, m, p, locals) => {
		let r = compile_statement(s, m, p, locals);
		r.code.forEach((e, i) => {
			if(e === undefined) {
				console.log('PROBLEM EXPRESSION:', ir_almost_pretty_print(s, 0), r.code);
				throw new Error(`IR BUG: Statement contains undefined instruction at index ${i}`);
			}
		});
		return r;
	};
	const compile_statement = (s, m, p, locals) => {
		try {
			const get_var = (id) => {
				if(id in locals) {
					return {global:false, info:locals[id]};
				}
				else if(id in globals_map) {
					return {global:true, info:globals_map[id]};
				}
				else {
					throw new Error(`Unknown variable: {${id}}`);
				}
			}
			if(s in locals) {
				let vinfo = locals[s];
				return {type:vinfo.type, code:[I.lget, leb_const(vinfo.index)]};
			}
			else if(s in globals_map) {
				let vinfo = globals_map[s];
				return {type:vinfo.type, code:[I.gget, leb_const(vinfo.index)]};
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
			case IR.i32const: {
				return {type: T.i32, code:[I.i32, leb_const(s[1])]};
			} break;
			case IR.rconst: {
				return {type: T.f64, code:[I.f64, f64_const(s[1])]};
			} break;
			case IR.assign: {
				let v = get_var(s[1]);
				let c = compile_statement_s(s[2], m, p, locals);
				if (v.info.type != c.type){
					throw new Error("Mismatched type between variable "+s[1]
						+" of type "+wasmTypeNames[v.info.type]+" and expression "+s[2]+" of type "+wasmTypeNames[c.type]);
				}
				return {type: T.block, code:[c.code, v.global? I.gset : I.lset, leb_const(v.info.index)]};
			} break;
			case IR.if_else: {
				let condition = compile_statement_s(s[1], m, p, locals);
				if(condition.type != T.i32) {
					console.log(s);
					console.log(condition);
					throw new Error('Conditions should be of type i32, not provided type: '+ condition.type);
				}
				let iftrue = compile_statement_s(s[2], m, p, locals);
				let iffalse = compile_statement_s(s[3], m, p, locals);
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
				let exp = compile_statement_s(s[1], m, p, locals);
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
					throw new Error(`Procedure {${[s[1]]}} expected ${proc.params.length} arguments, recieved ${s.length - 2}`);
				}
				let code = [];
				for(let i = 2; i < s.length; i++) {
					let arg = compile_statement_s(s[i], m, p, locals);
					if(arg.type != proc.params[i-2]){
						console.log(s[i]);
						console.log(arg);
						throw new Error("Mismatched type for arg "+(i-2)+" for procedure "+s[1]+": "
							+wasmTypeNames[proc.params[i-2]]+" expected, "+wasmTypeNames[arg.type]+" received.");
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
				let condition = compile_statement_s(s[1], m, p, locals);
				if(condition.type != T.i32) {
					console.log(s[1]);
					console.log(s);
					throw new Error("Condition expression expected to be an i32, it was actually of type "+ printTypeName(condition.type));
				}
				let body = compile_statement_s(s[2], m, p, locals);
				if(body.type != T.block) {
					console.log(s[2]);
					console.log(s);
					throw new Error("Loop body expected to be a block type, it was actually of type "+ printTypeName(body.type));
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
				let condition = compile_statement_s(s[1], m, p, locals);
				if(condition.type != T.i32) {
					console.log(s[1]);
					console.log(s);
					throw new Error("Conditional expression expected to be an i32, it was actually of type "+ printTypeName(condition.type));
				}
				let body = compile_statement_s(s[2], m, p, locals);
				if(body.type != T.block) {
					console.log(s[2]);
					console.log(s);
					throw new Error("If-then body expected to be a block type, it was actually of type "+ printTypeName(block.type));
				}
				return {
					type: T.block,
					code: [
						I.block, T.block, condition.code, I.i32eqz, I.br_if, 0,
							body.code,
						I.end
					]
				};
			} break;
			case IR.block: {
				let code = [];
				for (let i = 1; i < s.length; i++) {
					let c = compile_statement_s(s[i], m, p, locals)
					// Drop the result to keep the stack clean
					if(c.type != T.block){
						c.code.push(I.drop);
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
			console.log("Failed in statement: ", ir_almost_pretty_print(s, 0));
			throw error;
		}
	};
	// Again
	for(let p in procedures) {
		let proc = procedures[p];
		if("inline" in proc || 'import' in proc) {
			continue;
		}
		proc.index += imported.length;
	}
	// We gathered all the names. Now time to compile the code
	for(let p in procedures) {
		let proc = procedures[p];
		if("inline" in proc || 'import' in proc) {
			continue;
		}
		let var_map = {};
		if(proc.param_names) {
			proc.param_names.forEach((e, i) => {
				if(e in var_map) {
					throw new Error("Duplicate local variable: "+e);
				}
				var_map[e] = {index:i, type:proc.params[i]};
				var_map[i] = var_map[e];
			});
		}
		let locals = [];
		if(proc.locals) {
			let locals_start = proc.params.length;
			for(let p in proc.locals) {
				let list = proc.locals[p];
				let type = list.shift();
				locals.push([list.length, type]);
				list.forEach((name, i) => {
					let local_index = i+locals_start;
					var_map[name] = {index:local_index, type:type};
					var_map[local_index] = var_map[name];
				});
				locals_start += list.length;
			}
		}
		try {
			let compiled = compile_statement_s(proc.code, procedures, proc, var_map);
			code[proc.index - imported.length] = [locals, compiled.code];
			if (proc.exported) {
				exported.push([p, E.func, proc.index]);
			}
		}
		catch(error) {
			console.log('ASSEMBLER BUG: IR failed while compiling code for', p);
			throw error;
		}
	}
	return [
		[M.types].concat(types),
		[M.imports].concat(imported),
		[M.funcs].concat(funcs),
		[M.globals].concat(globals),
		[M.exports].concat(exported),
		[M.code].concat(code)
	];
}