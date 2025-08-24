import { IsEmail, IsNotEmpty } from "class-validator";
import { Transform } from "class-transformer";

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value
  )
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  password!: string;
}
