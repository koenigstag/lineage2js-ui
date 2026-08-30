function fn_not_implemented(...args: any[]) { throw new Error(`Called non-implemented function with arguments: ${JSON.stringify(args, undefined, 4)}`) };

function registerNativeFuncs(registry: C.INativeRegistry) {
    const native = registry.registerNativeFunc.bind(registry);

    // boolean operators
    native(129, function pre_op_not_bool() { fn_not_implemented(...arguments); });
    native(242, function op_eq_bool_bool() { fn_not_implemented(...arguments); });
    native(243, function op_not_eq_bool_bool() { fn_not_implemented(...arguments); });
    native(130, function op_and_bool_bool() { fn_not_implemented(...arguments); });
    native(131, function op_xor_bool_bool() { fn_not_implemented(...arguments); });
    native(132, function op_or_bool_bool() { fn_not_implemented(...arguments); });

    // byte operators
    native(133, function op_mul_num_num() { fn_not_implemented(...arguments); });
    native(134, function op_div_int_int() { fn_not_implemented(...arguments); });
    native(135, function op_add_num_num() { fn_not_implemented(...arguments); });
    native(136, function op_sub_num_num() { fn_not_implemented(...arguments); });
    native(137, function op_inc_num() { fn_not_implemented(...arguments); });
    native(138, function op_dec_num() { fn_not_implemented(...arguments); });
    native(139, function op_inc_num() { fn_not_implemented(...arguments); });
    native(140, function op_dec_num() { fn_not_implemented(...arguments); });
    native(141, function op_inv_num() { fn_not_implemented(...arguments); });

    // integer operators
    native(143, function op_sub_num_num() { fn_not_implemented(...arguments); });
    native(144, function op_mul_num_num() { fn_not_implemented(...arguments); });
    native(145, function op_div_int_int() { fn_not_implemented(...arguments); });
    native(146, function op_add_num_num() { fn_not_implemented(...arguments); });
    native(147, function op_sub_num_num() { fn_not_implemented(...arguments); });
    native(148, function op_shl_num_num() { fn_not_implemented(...arguments); });
    native(149, function op_shr_arithmetic_num_num() { fn_not_implemented(...arguments); });
    native(196, function op_shr_num_num() { fn_not_implemented(...arguments); });
    native(150, function op_le_num_num() { fn_not_implemented(...arguments); });
    native(151, function op_gt_num_num() { fn_not_implemented(...arguments); });
    native(152, function op_leq_num_num() { fn_not_implemented(...arguments); });
    native(153, function op_gtq_num_num() { fn_not_implemented(...arguments); });
    native(154, function op_eq_num_num() { fn_not_implemented(...arguments); });
    native(155, function op_neq_num_num() { fn_not_implemented(...arguments); });
    native(156, function op_and_bit_num_num() { fn_not_implemented(...arguments); });
    native(157, function op_xor_bit_num_num() { fn_not_implemented(...arguments); });
    native(158, function op_or_bit_num_num() { fn_not_implemented(...arguments); });
    native(159, function op_mul_num_num() { fn_not_implemented(...arguments); });
    native(160, function op_div_int_int() { fn_not_implemented(...arguments); });
    native(161, function op_add_num_num() { fn_not_implemented(...arguments); });
    native(162, function op_sub_num_num() { fn_not_implemented(...arguments); });
    native(163, function op_inc_num() { fn_not_implemented(...arguments); });
    native(164, function op_dec_num() { fn_not_implemented(...arguments); });
    native(165, function op_inc_num() { fn_not_implemented(...arguments); });
    native(166, function op_dec_num() { fn_not_implemented(...arguments); });

    // integer functions
    native(167, function rand_int() { fn_not_implemented(...arguments); });
    native(249, function min_num() { fn_not_implemented(...arguments); });
    native(250, function max_num() { fn_not_implemented(...arguments); });
    native(251, function clamp_num() { fn_not_implemented(...arguments); });

    // float operators
    native(169, function op_sub_num_num() { fn_not_implemented(...arguments); });
    native(170, function op_pow_num_num() { fn_not_implemented(...arguments); });
    native(171, function op_mul_num_num() { fn_not_implemented(...arguments); });
    native(172, function op_div_num_num() { fn_not_implemented(...arguments); });
    native(173, function op_mod_num_num() { fn_not_implemented(...arguments); });
    native(174, function op_add_num_num() { fn_not_implemented(...arguments); });
    native(175, function op_sub_num_num() { fn_not_implemented(...arguments); });
    native(176, function op_le_num_num() { fn_not_implemented(...arguments); });
    native(177, function op_gt_num_num() { fn_not_implemented(...arguments); });
    native(178, function op_leq_num_num() { fn_not_implemented(...arguments); });
    native(179, function op_gtq_num_num() { fn_not_implemented(...arguments); });
    native(180, function op_eq_num_num() { fn_not_implemented(...arguments); });
    native(210, function op_eq_approx_num_num() { fn_not_implemented(...arguments); });
    native(181, function op_neq_num_num() { fn_not_implemented(...arguments); });
    native(182, function op_mul_num_num() { fn_not_implemented(...arguments); });
    native(183, function op_div_num_num() { fn_not_implemented(...arguments); });
    native(184, function op_add_num_num() { fn_not_implemented(...arguments); });
    native(185, function op_sub_num_num() { fn_not_implemented(...arguments); });

    // float functions
    native(186, function Abs() { fn_not_implemented(...arguments); });
    native(187, function Sin() { fn_not_implemented(...arguments); });
    native("Asin", function Asin() { fn_not_implemented(...arguments); });
    native(188, function Cos() { fn_not_implemented(...arguments); });
    native("Acos", function Acos() { fn_not_implemented(...arguments); });
    native(189, function Tan() { fn_not_implemented(...arguments); });
    native(190, function Atan() { fn_not_implemented(...arguments); });
    native(191, function Exp() { fn_not_implemented(...arguments); });
    native(192, function Loge() { fn_not_implemented(...arguments); });
    native(193, function Sqrt() { fn_not_implemented(...arguments); });
    native(194, function Square() { fn_not_implemented(...arguments); });
    native(195, function FRand() { fn_not_implemented(...arguments); });
    native(244, function FMin() { fn_not_implemented(...arguments); });
    native(245, function FMax() { fn_not_implemented(...arguments); });
    native(246, function FClamp() { fn_not_implemented(...arguments); });
    native(247, function Lerp() { fn_not_implemented(...arguments); });
    native(248, function Smerp() { fn_not_implemented(...arguments); });

    // vector operators
    native(211, function pre_op_sub_vector() { fn_not_implemented(...arguments); });
    native(212, function op_mul_vector_float() { fn_not_implemented(...arguments); });
    native(213, function op_mul_float_vector() { fn_not_implemented(...arguments); });
    native(296, function op_mul_vector_vector() { fn_not_implemented(...arguments); });
    native(214, function op_div_vector_float() { fn_not_implemented(...arguments); });
    native(215, function op_add_vector_vector() { fn_not_implemented(...arguments); });
    native(216, function op_sub_vector_vector() { fn_not_implemented(...arguments); });
    native(275, function op_vec_rot_lsh() { fn_not_implemented(...arguments); });  // vector <<    ( vector A, rotator B );
    native(276, function op_vec_rot_rsh() { fn_not_implemented(...arguments); });  // vector >>    ( vector A, rotator B );
    native(217, function op_eq_vector_vector() { fn_not_implemented(...arguments); });
    native(218, function op_neq_vector_vector() { fn_not_implemented(...arguments); });
    native(219, function op_dot_vector_vector() { fn_not_implemented(...arguments); });
    native(220, function op_cross_vector_vector() { fn_not_implemented(...arguments); });
    native(221, function op_mul_vector_float() { fn_not_implemented(...arguments); });
    native(297, function op_mul_vector_vector() { fn_not_implemented(...arguments); });
    native(222, function op_div_vector_float() { fn_not_implemented(...arguments); });
    native(223, function op_add_vector_vector() { fn_not_implemented(...arguments); });
    native(224, function op_sub_vector_vector() { fn_not_implemented(...arguments); });

    // vector functions
    native(225, function VSize() { fn_not_implemented(...arguments); });
    native(226, function Normal() { fn_not_implemented(...arguments); });
    native(227, function vec_Invert() { fn_not_implemented(...arguments); }); // Invert
    native(252, function VRand() { fn_not_implemented(...arguments); });
    native(300, function vec_MirrorByNormal() { fn_not_implemented(...arguments); }); // MirrorByNormal

    // Rotator operators and functions.
    native(142, function op_eq_rotator_rotator() { fn_not_implemented(...arguments); }); // static final operator(24) bool ==     ( rotator A, rotator B );
    native(203, function op_neq_rotator_rotator() { fn_not_implemented(...arguments); }); // static final operator(26) bool !=     ( rotator A, rotator B );
    native(287, function op_mul_rotator_float() { fn_not_implemented(...arguments); }); // static final operator(16) rotator *   ( rotator A, float    B );
    native(288, function op_mul_float_rotator() { fn_not_implemented(...arguments); }); // static final operator(16) rotator *   ( float    A, rotator B );
    native(289, function op_div_rotator_float() { fn_not_implemented(...arguments); }); // static final operator(16) rotator /   ( rotator A, float    B );
    native(290, function op_mul_rotator_float() { fn_not_implemented(...arguments); }); // static final operator(34) rotator *=  ( out rotator A, float B  );
    native(291, function op_div_rotator_float() { fn_not_implemented(...arguments); }); // static final operator(34) rotator /=  ( out rotator A, float B  );
    native(316, function op_add_rotator_rotator() { fn_not_implemented(...arguments); }); // static final operator(20) rotator +   ( rotator A, rotator B );
    native(317, function op_sub_rotator_rotator() { fn_not_implemented(...arguments); }); // static final operator(20) rotator -   ( rotator A, rotator B );
    native(318, function op_add_rotator_rotator() { fn_not_implemented(...arguments); }); // static final operator(34) rotator +=  ( out rotator A, rotator B );
    native(319, function op_sub_rotator_rotator() { fn_not_implemented(...arguments); }); // static final operator(34) rotator -=  ( out rotator A, rotator B );
    native(229, function GetAxes() { fn_not_implemented(...arguments); }); // static final function GetAxes         ( rotator A, out vector X, out vector Y, out vector Z );
    native(230, function GetUnAxes() { fn_not_implemented(...arguments); }); // static final function GetUnAxes       ( rotator A, out vector X, out vector Y, out vector Z );
    native(320, function RotRand() { fn_not_implemented(...arguments); }); // static final function rotator RotRand ( optional bool bRoll );
    native("OrthoRotation", function rot_OrthoRotation() { fn_not_implemented(...arguments); }); //      static final function rotator OrthoRotation( vector X, vector Y, vector Z );
    native("Normalize", function rot_Normalize() { fn_not_implemented(...arguments); }); //      static final function rotator Normalize( rotator Rot );
    native("op_ClockwiseFrom_int_int", function op_ClockwiseFrom_int_int() { fn_not_implemented(...arguments); }); //static final operator(24) bool ClockwiseFrom( int A, int B );
    native("Vector2Rotator", function rot_Vector2Rotator() { fn_not_implemented(...arguments); }); //      static final function rotator Vector2Rotator( vector V );
    native("Rotator2Vector", function rot_Rotator2Vector() { fn_not_implemented(...arguments); }); //      static final function vector Rotator2Vector( rotator R );


    // String operators.
    native(112, function op_cat_str_str() { fn_not_implemented(...arguments); });
    native(168, function op_scat_str_str() { fn_not_implemented(...arguments); });
    native(115, function op_le_str_str() { fn_not_implemented(...arguments); });
    native(116, function op_ge_str_str() { fn_not_implemented(...arguments); });
    native(120, function op_leq_str_str() { fn_not_implemented(...arguments); });
    native(121, function op_geq_str_str() { fn_not_implemented(...arguments); });
    native(122, function op_eq_str_str() { fn_not_implemented(...arguments); });
    native(123, function op_neq_str_str() { fn_not_implemented(...arguments); });
    native(124, function op_eq_case_str_str() { fn_not_implemented(...arguments); });

    // String functions.
    native(125, function Len() { fn_not_implemented(...arguments); }); // static final function int    Len    ( coerce string S );
    native(126, function InStr() { fn_not_implemented(...arguments); }); // static final function int    InStr  ( coerce string S, coerce string t );
    native(127, function Mid() { fn_not_implemented(...arguments); }); // static final function string Mid    ( coerce string S, int i, optional int j );
    native(128, function Left() { fn_not_implemented(...arguments); }); // static final function string Left   ( coerce string S, int i );
    native(234, function Right() { fn_not_implemented(...arguments); }); // static final function string Right  ( coerce string S, int i );
    native(235, function Caps() { fn_not_implemented(...arguments); }); // static final function string Caps   ( coerce string S );
    native(236, function Chr() { fn_not_implemented(...arguments); }); // static final function string Chr    ( int i );
    native(237, function Asc() { fn_not_implemented(...arguments); }); // static final function int    Asc    ( string S );

    // Object operators.
    native(114, function op_eq_object_object() { fn_not_implemented(...arguments); }); // static final operator(24) bool == ( Object A, Object B );
    native(119, function op_eq_object_object() { fn_not_implemented(...arguments); }); // static final operator(26) bool != ( Object A, Object B );

    // Name operators.
    native(254, function op_eq_name_name() { fn_not_implemented(...arguments); }); // static final operator(24) bool == ( name A, name B );
    native(255, function op_neq_name_name() { fn_not_implemented(...arguments); }); // static final operator(26) bool != ( name A, name B );

    // InterpCurve operator
    native("InterpCurveEval", function InterpCurveEval() { fn_not_implemented(...arguments); }); //   static final function float InterpCurveEval( InterpCurve curve, float input );
    native("InterpCurveGetOutputRange", function InterpCurveGetOutputRange() { fn_not_implemented(...arguments); }); // static final function InterpCurveGetOutputRange( InterpCurve curve, out float min, out float max );
    native("InterpCurveGetInputDomain", function InterpCurveGetInputDomain() { fn_not_implemented(...arguments); }); // static final function InterpCurveGetInputDomain( InterpCurve curve, out float min, out float max );

    // Quaternion functions
    native("QuatProduct", function QuatProduct() { fn_not_implemented(...arguments); }); //   static final function Quat QuatProduct( Quat A, Quat B );
    native("QuatInvert", function QuatInvert() { fn_not_implemented(...arguments); }); //    static final function Quat QuatInvert( Quat A );
    native("QuatRotateVector", function QuatRotateVector() { fn_not_implemented(...arguments); }); //  static final function vector QuatRotateVector( Quat A, vector B );
    native("QuatFindBetween", function QuatFindBetween() { fn_not_implemented(...arguments); }); //   static final function Quat QuatFindBetween( Vector A, Vector B );
    native("QuatFromAxisAndAngle", function QuatFromAxisAndAngle() { fn_not_implemented(...arguments); }); //  static final function Quat QuatFromAxisAndAngle( Vector Axis, Float Angle );

    // Logging.
    native(231, function Log() { fn_not_implemented(...arguments); }); // final static function Log(coerce string S, optional name Tag);
    native(232, function Warn() { fn_not_implemented(...arguments); }); // final static function Warn(coerce string S);
    native("Localize", function Localize() { fn_not_implemented(...arguments); }); // static function string Localize(string SectionName, string KeyName, string PackageName);

    // Goto state and label.
    native(113, function GotoState() { fn_not_implemented(...arguments); }); // final function GotoState(optional name NewState, optional name Label);
    native(281, function IsInState() { fn_not_implemented(...arguments); }); // final function bool IsInState(name TestState);
    native(284, function GetStateName() { fn_not_implemented(...arguments); }); // final function name GetStateName();

    // Objects.
    native(258, function ClassIsChildOf() { fn_not_implemented(...arguments); }); // static final function bool ClassIsChildOf(class TestClass, class ParentClass );
    native(303, function IsA() { fn_not_implemented(...arguments); }); // final function bool IsA(name ClassName);

    // Probe messages.
    native(117, function Enable() { fn_not_implemented(...arguments); }); // final function Enable(name ProbeFunc);
    native(118, function Disable() { fn_not_implemented(...arguments); }); // final function Disable(name ProbeFunc);

    // Properties.
    native("GetPropertyText", function GetPropertyText() { fn_not_implemented(...arguments); }); //    final function string GetPropertyText( string PropName );
    native("SetPropertyText", function SetPropertyText() { fn_not_implemented(...arguments); }); // final function SetPropertyText( string PropName, string PropValue );
    native("GetEnum", function GetEnum() { fn_not_implemented(...arguments); }); // static final function name GetEnum( object E, int i );
    native("DynamicLoadObject", function DynamicLoadObject() { fn_not_implemented(...arguments); }); // static final function object DynamicLoadObject( string ObjectName, class ObjectClass, optional bool MayFail );
    native("FindObject", function FindObject() { fn_not_implemented(...arguments); }); // static final function object FindObject( string ObjectName, class ObjectClass );

    // Configuration.
    native(536, function SaveConfig() { fn_not_implemented(...arguments); });    // final function SaveConfig();
    native("StaticSaveConfig", function StaticSaveConfig() { fn_not_implemented(...arguments); });   // static final function StaticSaveConfig();
    native("ResetConfig", function ResetConfig() { fn_not_implemented(...arguments); });    // static final function ResetConfig();

}

export default registerNativeFuncs;
export { registerNativeFuncs };