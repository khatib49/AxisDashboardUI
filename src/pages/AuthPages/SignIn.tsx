import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="AXIS Admin — Sign in"
        description="Sign in to the AXIS Game Lounge operations console."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
