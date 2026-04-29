import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="AXIS Admin — Request Access"
        description="Request an operator account for the AXIS Game Lounge admin console."
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
