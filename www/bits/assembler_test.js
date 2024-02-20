let test_module = [
	[ M.types,
		// Arguments and results
		[[T.i32, T.i32], [T.i32]],
		[[T.f32, T.i32], [T.f32]],
	],
	[ M.funcs,
		// ID from types
		0, 1
	],
	[ M.exports,
		["add", E.func, 0],
		["ipow", E.func, 1]
	],
	[ M.code,
		// Locals, then code
		[[], [I.lget, leb_const(0), I.lget, leb_const(1), I.i32add, I.return]],
		[[[1, T.f32]], [
			I.f32, f32_const(1),
			I.lset, 2,
			I.block, T.block,
				I.loop, T.block,
					I.lget, 1, I.i32eqz, I.br_if, 1,
					I.lget, 2, I.lget, 0, I.f32mul,
					I.lset, 2,
					I.lget, 1, I.i32, 1, I.i32sub,
					I.lset, 1,
					I.br, 0,
				I.end,
			I.end,
			I.lget, 2,
			I.return
			
		]] 
	]
];

let wasm = await assemble(test_module);
