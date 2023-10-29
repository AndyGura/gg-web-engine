/**
 * A rule applied to combine coefficients.
 *
 * Use this when configuring the `ColliderDesc` to specify
 * how friction and restitution coefficient should be combined
 * in a contact.
 */
export var CoefficientCombineRule;
(function (CoefficientCombineRule) {
    CoefficientCombineRule[CoefficientCombineRule["Average"] = 0] = "Average";
    CoefficientCombineRule[CoefficientCombineRule["Min"] = 1] = "Min";
    CoefficientCombineRule[CoefficientCombineRule["Multiply"] = 2] = "Multiply";
    CoefficientCombineRule[CoefficientCombineRule["Max"] = 3] = "Max";
})(CoefficientCombineRule || (CoefficientCombineRule = {}));
//# sourceMappingURL=coefficient_combine_rule.js.map