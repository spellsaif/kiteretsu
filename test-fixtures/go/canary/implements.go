package canary
import "test-fixtures/go/canary/core"
type MyStruct struct{}
func (s MyStruct) Do() {} // Implements core.UtilInterface
