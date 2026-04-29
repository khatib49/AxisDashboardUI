import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="AXIS GAME LOUNGE - SignIn"
        description="This is the SignIn page for AXIS GAME LOUNGE"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
