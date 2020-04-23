// package triggerfns contains logic for triggering a fluxmonitor report
// according to arbitrary rules.
package triggerfns

import (
	"database/sql"
	"database/sql/driver"

	"github.com/smartcontractkit/chainlink/core/store/models"

	"github.com/pkg/errors"
	"github.com/shopspring/decimal"
)

// triggerFnFactories maps the names of the trigger functions used in a JSON job
// spec with a fluxmonitor initiator to the corresponding factory functions. New
// threshold functions should be added here.
var triggerFnFactories = map[string]struct {
	factory func(params interface{}) (TriggerFn, error)
}{
	"relativeThreshold": {relativeThresholdFactory},
	"absoluteThreshold": {absoluteThresholdFactory},
}

// TriggerFn is used to track which trigger functions a fluxmonitor initiator
// uses.
type TriggerFn interface {
	// Triggering returns true if the deviation between the current and new values
	// implies that the new value should be reported to the fluxAggregator
	// contract.
	Triggering(current, new decimal.Decimal, extraData ...interface{}) (bool, error)
	// Parameters returns the parameters passed to the factory to create this trigger
	Parameters() interface{}
	// Factory returns the name of the factory function which created this trigger
	Factory() string
}

// TriggerFns is a collection of ThresholdFn with convenient serialization
type TriggerFns []TriggerFn

var ( // interface assertions
	_ driver.Valuer = TriggerFns{}
	_ sql.Scanner   = TriggerFns{}
)

func getTriggerFnMap(value interface{}) (map[string]interface{}, error) {
	// XXX: models.json creates circular dependency, and this code is garbage. fix
	var json = new(models.JSON)
	if err := json.Scan(value); err != nil {
		return nil, errors.Wrapf(err,
			"while trying to parse %s as trigger-function map", value)
	}
	if !json.IsObject() {
		return nil, errors.Errorf("trigger-function map %s should be a JSON object",
			json)
	}
	asMap, err := json.AsMap()
	if err != nil {
		return nil, errors.Wrapf(err, "could not read trigger-function map %s", json)
	}
	return asMap, nil
}

func makeTriggerFn(triggerFunctionName string, params interface{}) (TriggerFn, error) {
	triggerFnFactory, ok := triggerFnFactories[triggerFunctionName]
	if !ok {
		return errors.Errorf(`trigger function "%s" uknown`, triggerFunctionName)
	}
	if err != nil {
		return errors.Wrapf(err,
			`while parsing parameters for trigger function "%s"`, triggerFunctionName)
	}
	triggerFn, err := triggerFnFactory.factory(params)
	if err != nil {
		return errors.Wrapf(err,
			`while deserializing trigger function "%s" from parameters %s`,
			triggerFunctionName, params)
	}
}

func (f TriggerFns) Scan(value interface{}) error {
	asMap, err := getTriggerFnMap(value)
	if err != nil {
		return err
	}
	for triggerFunctionName, params := range asMap {
		triggerFn, err := makeTriggerFn(triggerFunctionName, params)
		f = append(f, triggerFn)
	}
	return nil
}

func (f TriggerFns) Value() (driver.Value, error) {
	entries := models.KV{}
	for _, tfn := range f {
		entries[tfn.Factory()] = tfn.Parameters()
	}
	asJSON, err := models.JSON{}.MultiAdd(entries)
	if err != nil {
		return nil, errors.Wrapf(err, "while serializing trigger functions %+v", f)
	}
	return asJSON.Bytes(), nil
}

type floatTriggerFn struct {
	triggering func(current, new decimal.Decimal, extraData ...interface{}) (bool, error)
	factory    string
	parameters float64
}

var _ TriggerFn = floatTriggerFn{} // interface assertion

func (t floatTriggerFn) Triggering(current, new decimal.Decimal,
	extraData ...interface{}) (bool, error) {
	return t.triggering(current, new, extraData...)
}

func (t floatTriggerFn) Parameters() interface{} { return t.parameters }
func (t floatTriggerFn) Factory() string         { return t.factory }

func relativeThresholdFactory(params interface{}) (rv TriggerFn, err error) {
	if threshold, ok := params.(float64); ok {
		dthreshold := decimal.NewFromFloat(threshold)
		return floatTriggerFn{
			triggering: func(current, new decimal.Decimal,
				extraData ...interface{}) (bool, error) {
				if current.Sign() != 0 { // current != 0, so |current-new|/|current| < ∞
					// Trigger if |current-new|/|current| >= threshold
					return !current.Sub(new).Div(current).Abs().LessThan(dthreshold), nil
				}
				// current == 0 case
				//
				// If new != 0, |current-new|/|current| = ∞ > threshold, so trigger
				// If new == 0, new == current, so do not trigger (no deviation)
				return new.Sign() != 0, nil
			},
			factory:    "relativeThreshold",
			parameters: threshold,
		}, nil
	}
	return nil, errors.Errorf("expected float parameter, got %+v", params)
}

func absoluteThresholdFactory(params interface{}) (TriggerFn, error) {
	if threshold, ok := params.(float64); ok {
		dthreshold := decimal.NewFromFloat(threshold)
		return floatTriggerFn{
			triggering: func(current, new decimal.Decimal,
				extraData ...interface{}) (bool, error) {
				// Trigger if |current-new| >= threshold
				return !current.Sub(new).Abs().LessThan(dthreshold), nil
			},
			factory:    "absoluteThreshold",
			parameters: threshold,
		}, nil
	}
	return nil, errors.Errorf("expected float parametr, got %+v", params)
}
