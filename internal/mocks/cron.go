// Code generated by mockery v1.0.0. DO NOT EDIT.

package mocks

import mock "github.com/stretchr/testify/mock"

// Cron is an autogenerated mock type for the Cron type
type Cron struct {
	mock.Mock
}

// AddFunc provides a mock function with given fields: _a0, _a1
func (_m *Cron) AddFunc(_a0 string, _a1 func()) error {
	ret := _m.Called(_a0, _a1)

	var r0 error
	if rf, ok := ret.Get(0).(func(string, func()) error); ok {
		r0 = rf(_a0, _a1)
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

// Start provides a mock function with given fields:
func (_m *Cron) Start() {
	_m.Called()
}

// Stop provides a mock function with given fields:
func (_m *Cron) Stop() {
	_m.Called()
}