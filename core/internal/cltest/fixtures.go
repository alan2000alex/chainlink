package cltest

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"testing"

	"github.com/smartcontractkit/chainlink/core/eth"
	"github.com/smartcontractkit/chainlink/core/store/models"

	gethCommon "github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

const (
	key3cb8e3fd9d27e39a5e9e6852b0e96160061fd4ea = `{"address":"3cb8e3fd9d27e39a5e9e6852b0e96160061fd4ea","crypto":{"cipher":"aes-128-ctr","ciphertext":"7515678239ccbeeaaaf0b103f0fba46a979bf6b2a52260015f35b9eb5fed5c17","cipherparams":{"iv":"87e5a5db334305e1e4fb8b3538ceea12"},"kdf":"scrypt","kdfparams":{"dklen":32,"n":262144,"p":1,"r":8,"salt":"d89ac837b5dcdce5690af764762fe349d8162bb0086cea2bc3a4289c47853f96"},"mac":"57a7f4ada10d3d89644f541c91f89b5bde73e15e827ee40565e2d1f88bb0ac96"},"id":"c8cb9bc7-0a51-43bd-8348-8a67fd1ec52c","version":3}`
)

// MustHelloWorldAgreement returns a hello world agreement with the provided address added to the Oracle whitelist
func MustHelloWorldAgreement(t *testing.T, oracleAddress gethCommon.Address) string {
	template := MustReadFile(t, "testdata/hello_world_agreement.json")
	oracles := []string{oracleAddress.Hex()}
	sa, err := sjson.SetBytes(template, "oracles", oracles)
	if err != nil {
		t.Fatal(err)
	}
	return string(sa)

}

func CreateCredsFile(t *testing.T, user models.User) (string, func()) {
	credsFile, err := ioutil.TempFile(os.TempDir(), "apicredentials-")
	if err != nil {
		t.Fatal("Cannot create temporary file", err)
	}
	creds := []byte(fmt.Sprintf("%s\n%s", user.Email, Password))
	if _, err = credsFile.Write(creds); err != nil {
		t.Fatal("Failed to write to temporary file", err)
	}
	return credsFile.Name(), func() {
		os.Remove(credsFile.Name())
	}
}

// FixtureCreateJobViaWeb creates a job from a fixture using /v2/specs
func FixtureCreateJobViaWeb(t *testing.T, app *TestApplication, path string) models.JobSpec {
	return CreateSpecViaWeb(t, app, string(MustReadFile(t, path)))
}

// JSONFromFixture create models.JSON from file path
func JSONFromFixture(t *testing.T, path string) models.JSON {
	return JSONFromBytes(t, MustReadFile(t, path))
}

// JSONResultFromFixture create model.JSON with params.result found in the given file path
func JSONResultFromFixture(t *testing.T, path string) models.JSON {
	res := gjson.Get(string(MustReadFile(t, path)), "params.result")
	return JSONFromString(t, res.String())
}

// LogFromFixture create ethtypes.log from file path
func LogFromFixture(t *testing.T, path string) eth.Log {
	value := gjson.Get(string(MustReadFile(t, path)), "params.result")
	var el eth.Log
	require.NoError(t, json.Unmarshal([]byte(value.String()), &el))

	return el
}

// TxReceiptFromFixture create ethtypes.log from file path
func TxReceiptFromFixture(t *testing.T, path string) eth.TxReceipt {
	jsonStr := JSONFromFixture(t, path).Get("result").String()

	var receipt eth.TxReceipt
	err := json.Unmarshal([]byte(jsonStr), &receipt)
	require.NoError(t, err)

	return receipt
}
